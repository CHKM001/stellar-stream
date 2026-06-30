import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { StreamsTable, STREAMS_TABLE_VIRTUAL_OVERSCAN } from "./StreamsTable";
import { Stream } from "../types/stream";

const noop = vi.fn().mockResolvedValue(undefined);

function createMockStream(id: string, status: Stream["progress"]["status"] = "active"): Stream {
  const now = Math.floor(Date.now() / 1000);
  const startAt = now - 200;
  return {
    id,
    sender: "G_SENDER123456789012345678901234567890123456789012345678901",
    recipient: "G_RECIPIENT123456789012345678901234567890123456789012345",
    assetCode: "USDC",
    totalAmount: 100,
    durationSeconds: 1000,
    startAt,
    createdAt: now,
    progress: {
      status,
      ratePerSecond: 0.1,
      elapsedSeconds: 200,
      vestedAmount: 20,
      remainingAmount: 80,
      percentComplete: 20,
    },
  };
}

const mockStreams: Stream[] = [createMockStream("1")];

const defaultProps = {
  streams: mockStreams,
  filters: {},
  onFiltersChange: vi.fn(),
  onCancel: noop,
  onPause: noop,
  onResume: noop,
  onEditStartTime: vi.fn(),
};

function setScrollViewport(element: HTMLElement, height: number) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: height * 20,
  });
}

describe("StreamsTable column visibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides optional column by default and shows it when toggled", () => {
    render(<StreamsTable {...defaultProps} />);

    expect(screen.queryByRole("columnheader", { name: "Asset" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle table columns" }));
    fireEvent.click(screen.getByLabelText("Asset"));

    expect(screen.getByRole("columnheader", { name: "Asset" })).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("persists column visibility to localStorage", () => {
    const { unmount } = render(<StreamsTable {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle table columns" }));
    fireEvent.click(screen.getByLabelText("Asset"));

    const stored = JSON.parse(localStorage.getItem("stream-table-columns") ?? "{}");
    expect(stored.assetCode).toBe(true);

    unmount();
    render(<StreamsTable {...defaultProps} />);

    expect(screen.getByRole("columnheader", { name: "Asset" })).toBeInTheDocument();
  });
});

describe("StreamsTable virtual scrolling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses a bounded scroll container for the table body", () => {
    render(<StreamsTable {...defaultProps} />);

    const scrollContainer = screen.getByTestId("streams-table-scroll");
    expect(scrollContainer).toHaveClass("streams-table-scroll");
    expect(scrollContainer.getAttribute("style")).toContain("max-height");
  });

  it("renders only visible rows plus overscan for large lists", () => {
    const manyStreams = Array.from({ length: 500 }, (_, i) =>
      createMockStream(String(i + 1).padStart(4, "0")),
    );

    const view = render(<StreamsTable {...defaultProps} streams={manyStreams} />);
    setScrollViewport(screen.getByTestId("streams-table-scroll"), 400);
    view.rerender(<StreamsTable {...defaultProps} streams={manyStreams} />);

    const renderedRows = screen.getAllByRole("checkbox", {
      name: /^Select stream /,
    });
    const expectedMax =
      Math.ceil(400 / 52) + STREAMS_TABLE_VIRTUAL_OVERSCAN + 2;

    expect(renderedRows.length).toBeLessThan(500);
    expect(renderedRows.length).toBeLessThanOrEqual(expectedMax);
  });

  it("configures virtual overscan to five rows", () => {
    expect(STREAMS_TABLE_VIRTUAL_OVERSCAN).toBe(5);
  });

  it("preserves keyboard focus order for rendered row actions", () => {
    render(<StreamsTable {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel stream 1" });
    cancelButton.focus();
    expect(document.activeElement).toBe(cancelButton);
  });
});

describe("StreamsTable infinite scroll", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders sentinel element for infinite scroll", () => {
    render(<StreamsTable {...defaultProps} onLoadMore={vi.fn()} hasMore={true} />);
    expect(screen.getByTestId("infinite-scroll-sentinel")).toBeInTheDocument();
  });

  it("shows loading indicator when loadingMore is true", () => {
    render(<StreamsTable {...defaultProps} loadingMore={true} />);
    expect(screen.getByText(/Loading more streams/i)).toBeInTheDocument();
  });

  it("shows end of results message when hasMore is false", () => {
    render(<StreamsTable {...defaultProps} hasMore={false} />);
    expect(screen.getByText(/End of results/i)).toBeInTheDocument();
  });

  function createIntersectionObserverMock() {
    let observerCallback: IntersectionObserverCallback = () => {};
    const MockObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      root = null;
      rootMargin = "";
      thresholds = [];
    };
    return { MockObserver, getCallback: () => observerCallback };
  }

  it("calls onLoadMore when sentinel becomes visible", () => {
    const onLoadMore = vi.fn();
    const { MockObserver, getCallback } = createIntersectionObserverMock();

    vi.spyOn(window, "IntersectionObserver").mockImplementation(MockObserver as unknown as typeof IntersectionObserver);

    render(
      <StreamsTable
        {...defaultProps}
        onLoadMore={onLoadMore}
        hasMore={true}
        loadingMore={false}
      />,
    );

    // Simulate sentinel becoming visible
    const sentinel = screen.getByTestId("infinite-scroll-sentinel");
    getCallback()([{ isIntersecting: true, target: sentinel } as unknown as IntersectionObserverEntry], null!);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not call onLoadMore when hasMore is false", () => {
    const onLoadMore = vi.fn();
    const { MockObserver, getCallback } = createIntersectionObserverMock();

    vi.spyOn(window, "IntersectionObserver").mockImplementation(MockObserver as unknown as typeof IntersectionObserver);

    render(
      <StreamsTable
        {...defaultProps}
        onLoadMore={onLoadMore}
        hasMore={false}
        loadingMore={false}
      />,
    );

    const sentinel = screen.getByTestId("infinite-scroll-sentinel");
    getCallback()([{ isIntersecting: true, target: sentinel } as unknown as IntersectionObserverEntry], null!);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not call onLoadMore when already loadingMore", () => {
    const onLoadMore = vi.fn();
    const { MockObserver, getCallback } = createIntersectionObserverMock();

    vi.spyOn(window, "IntersectionObserver").mockImplementation(MockObserver as unknown as typeof IntersectionObserver);

    render(
      <StreamsTable
        {...defaultProps}
        onLoadMore={onLoadMore}
        hasMore={true}
        loadingMore={true}
      />,
    );

    const sentinel = screen.getByTestId("infinite-scroll-sentinel");
    getCallback()([{ isIntersecting: true, target: sentinel } as unknown as IntersectionObserverEntry], null!);

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});

describe("StreamsTable WebSocket progress updates", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_WS_URL", "ws://localhost:9999");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows disconnected banner when WebSocket is not connected", () => {
    render(<StreamsTable {...defaultProps} />);
    expect(screen.getByText(/Live updates paused/i)).toBeInTheDocument();
  });

  it("shows progress bar with correct percentage and countdown", () => {
    const streams = [
      createMockStream("1", "active"),
      createMockStream("2", "active"),
    ];
    
    render(<StreamsTable {...defaultProps} streams={streams} />);
    
    const progressCells = screen.getAllByText("20%");
    expect(progressCells).toHaveLength(2);
    expect(progressCells[0]).toBeInTheDocument();
    
    // Countdown timer is shown for active streams
    const countdowns = document.querySelectorAll(".progress-countdown");
    expect(countdowns.length).toBeGreaterThan(0);
    expect(countdowns[0].textContent).toMatch(/\d+m \d+s/);
    
    // Vested / total display
    const vestedSpans = document.querySelectorAll(".muted");
    expect(vestedSpans.length).toBeGreaterThan(0);
    expect(vestedSpans[0].textContent).toContain("USDC");
  });
});
