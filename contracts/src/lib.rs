#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token::Client as TokenClient, Address, Env,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stream {
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub canceled: bool,
    /// Unix timestamp when the stream was paused, or 0 if not currently paused.
    pub paused_at: u64,
    /// Accumulated seconds the stream has been paused (across all pause/resume cycles).
    pub paused_duration: u64,
}

#[contracttype]
enum DataKey {
    NextStreamId,
    Stream(u64),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamCreated {
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamClaimed {
    pub stream_id: u64,
    pub recipient: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamCanceled {
    pub stream_id: u64,
    pub sender: Address,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamPaused {
    pub stream_id: u64,
    pub sender: Address,
    pub paused_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamResumed {
    pub stream_id: u64,
    pub sender: Address,
    pub resumed_at: u64,
    pub paused_duration: u64,
}

#[contract]
pub struct StellarStreamContract;

#[contractimpl]
impl StellarStreamContract {
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        end_time: u64,
    ) -> u64 {
        sender.require_auth();

        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }
        if end_time <= start_time {
            panic!("end_time must be greater than start_time");
        }

        // checks sebder balance.
        let token_client = TokenClient::new(&env, &token);
        let sender_balance = token_client.balance(&sender);
        if sender_balance < total_amount {
            panic!("insufficient sender balance");
        }

        // escrow = transfer total_amount from sender into this contract
        let contract_address = env.current_contract_address();
        token_client.transfer(&sender, &contract_address, &total_amount);

        let mut next_id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::NextStreamId)
            .unwrap_or(0);
        next_id += 1;

        let stream = Stream {
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            total_amount,
            claimed_amount: 0,
            start_time,
            end_time,
            canceled: false,
            paused_at: 0,
            paused_duration: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &next_id);
        env.storage()
            .persistent()
            .set(&DataKey::Stream(next_id), &stream);

        env.events().publish(
            (symbol_short!("Stream"), symbol_short!("Created")),
            StreamCreated {
                stream_id: next_id,
                sender,
                recipient,
                token,
                total_amount,
                start_time,
                end_time,
            },
        );

        next_id
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        read_stream(&env, stream_id)
    }

    pub fn get_next_stream_id(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::NextStreamId)
            .unwrap_or(0)
    }

    pub fn claimable(env: Env, stream_id: u64, at_time: u64) -> i128 {
        let stream = read_stream(&env, stream_id);
        let vested = vested_amount(&stream, at_time);
        let claimable = vested - stream.claimed_amount;
        if claimable < 0 {
            0
        } else {
            claimable
        }
    }

    pub fn claim(env: Env, stream_id: u64, recipient: Address, amount: i128) -> i128 {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let mut stream = read_stream(&env, stream_id);
        if stream.recipient != recipient {
            panic!("recipient mismatch");
        }
        recipient.require_auth();

        let now = env.ledger().timestamp();
        let claimable_now = Self::claimable(env.clone(), stream_id, now);

        // amount claimed cannot exceed vested amount
        if amount > claimable_now {
            panic!("amount exceeds claimable");
        }

        // transfer tokens from contract escrow to recipient
        let token_client = TokenClient::new(&env, &stream.token);
        let contract_address = env.current_contract_address();
        token_client.transfer(&contract_address, &recipient, &amount);

        // Update accounting after successful transfer
        stream.claimed_amount += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        env.events().publish(
            (symbol_short!("Stream"), symbol_short!("Claimed")),
            StreamClaimed {
                stream_id,
                recipient,
                amount,
            },
        );

        amount
    }

    pub fn pause(env: Env, stream_id: u64, sender: Address) {
        let mut stream = read_stream(&env, stream_id);
        if stream.sender != sender {
            panic!("sender mismatch");
        }
        sender.require_auth();

        if stream.canceled {
            panic!("stream is canceled");
        }
        if stream.paused_at != 0 {
            panic!("stream is already paused");
        }

        let now = env.ledger().timestamp();
        if now >= stream.end_time {
            panic!("stream has already ended");
        }

        stream.paused_at = now;
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        env.events().publish(
            (symbol_short!("Stream"), symbol_short!("Paused")),
            StreamPaused {
                stream_id,
                sender,
                paused_at: now,
            },
        );
    }

    pub fn resume(env: Env, stream_id: u64, sender: Address) {
        let mut stream = read_stream(&env, stream_id);
        if stream.sender != sender {
            panic!("sender mismatch");
        }
        sender.require_auth();

        if stream.canceled {
            panic!("stream is canceled");
        }
        if stream.paused_at == 0 {
            panic!("stream is not paused");
        }

        let now = env.ledger().timestamp();
        let elapsed_pause = now - stream.paused_at;
        stream.paused_duration += elapsed_pause;
        // Extend end_time so the recipient doesn't lose vesting time.
        stream.end_time += elapsed_pause;
        stream.paused_at = 0;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        env.events().publish(
            (symbol_short!("Stream"), symbol_short!("Resumed")),
            StreamResumed {
                stream_id,
                sender,
                resumed_at: now,
                paused_duration: stream.paused_duration,
            },
        );
    }

    pub fn cancel(env: Env, stream_id: u64, sender: Address) {        let mut stream = read_stream(&env, stream_id);
        if stream.sender != sender {
            panic!("sender mismatch");
        }
        sender.require_auth();

        if stream.canceled {
            return;
        }

        let now = env.ledger().timestamp();
        stream.canceled = true;

        // compute vested BEFORE truncating end_time
        let vested = vested_amount(&stream, now);
        let sender_refund = stream.total_amount - vested;

        // truncate end_time so recipient can't claim past cancel point
        let min_end = if now > stream.start_time {
            now
        } else {
            stream.start_time
        };
        if min_end < stream.end_time {
            stream.end_time = min_end;
            // Adjust total_amount to match the vested amount at cancel time
            // This ensures that the vested calculation remains correct after truncation
            stream.total_amount = vested;
        }

        if sender_refund > 0 {
            let token_client = TokenClient::new(&env, &stream.token);
            let contract_address = env.current_contract_address();
            token_client.transfer(&contract_address, &sender, &sender_refund);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);

        env.events().publish(
            (symbol_short!("Stream"), symbol_short!("Canceled")),
            StreamCanceled { stream_id, sender },
        );
    }
}

fn read_stream(env: &Env, stream_id: u64) -> Stream {
    env.storage()
        .persistent()
        .get(&DataKey::Stream(stream_id))
        .unwrap_or_else(|| panic!("stream not found"))
}

fn vested_amount(stream: &Stream, at_time: u64) -> i128 {
    if at_time <= stream.start_time {
        return 0;
    }

    // If currently paused, treat at_time as the moment it was paused.
    let effective_now = if stream.paused_at != 0 && at_time > stream.paused_at {
        stream.paused_at
    } else {
        at_time
    };

    let effective_time = if effective_now >= stream.end_time {
        stream.end_time
    } else {
        effective_now
    };

    let elapsed = effective_time - stream.start_time;
    let total_duration = stream.end_time - stream.start_time;

    if total_duration == 0 {
        return 0;
    }

    stream.total_amount * (elapsed as i128) / (total_duration as i128)
}

#[cfg(test)]
mod test;
