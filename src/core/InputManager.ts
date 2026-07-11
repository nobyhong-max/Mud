type TapCallback = (x: number, y: number) => void;
type LongPressCallback = (duration: number) => void;
type DragCallback = (x: number, y: number) => void;

type DragHandlers = {
  startCb: DragCallback;
  moveCb: DragCallback;
  endCb: DragCallback;
};

type LogicalPoint = {
  x: number;
  y: number;
};

export class InputManager {
  public static readonly LONG_PRESS_MS = 600;

  private static readonly DRAG_THRESHOLD = 4;

  private readonly logicalWidth: number;
  private readonly logicalHeight: number;

  private canvasElement: HTMLElement | null = null;

  private readonly tapCallbacks: TapCallback[] = [];
  private readonly longPressCallbacks: LongPressCallback[] = [];
  private readonly dragHandlers: DragHandlers[] = [];

  private active = false;
  private activeTouchId: number | null = null;
  private dragging = false;
  private longPressTriggered = false;
  private pressStartTime = 0;
  private pressStartPoint: LogicalPoint = { x: 0, y: 0 };
  private lastPoint: LogicalPoint = { x: 0, y: 0 };
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(logicalWidth = 360, logicalHeight = 200) {
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
  }

  public init(canvasElement: HTMLElement): void {
    if (this.canvasElement === canvasElement) {
      return;
    }
    this.destroy();
    this.canvasElement = canvasElement;
    this.bindEvents(canvasElement);
  }

  public destroy(): void {
    if (!this.canvasElement) {
      return;
    }

    const el = this.canvasElement;
    el.removeEventListener("mousedown", this.handleMouseDown);
    el.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    el.removeEventListener("touchstart", this.handleTouchStart);
    el.removeEventListener("touchmove", this.handleTouchMove);
    window.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("touchcancel", this.handleTouchCancel);

    this.canvasElement = null;
    this.clearLongPressTimer();
    this.resetInteractionState();
  }

  public onTap(callback: TapCallback): void {
    this.tapCallbacks.push(callback);
  }

  public onLongPress(callback: LongPressCallback): void {
    this.longPressCallbacks.push(callback);
  }

  public onDrag(startCb: DragCallback, moveCb: DragCallback, endCb: DragCallback): void {
    this.dragHandlers.push({ startCb, moveCb, endCb });
  }

  private bindEvents(el: HTMLElement): void {
    el.addEventListener("mousedown", this.handleMouseDown);
    el.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    el.addEventListener("touchstart", this.handleTouchStart, { passive: true });
    el.addEventListener("touchmove", this.handleTouchMove, { passive: true });
    window.addEventListener("touchend", this.handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", this.handleTouchCancel, { passive: true });
  }

  private beginInteraction(clientX: number, clientY: number): void {
    if (!this.canvasElement) {
      return;
    }

    const point = this.toLogicalPoint(clientX, clientY);
    this.active = true;
    this.dragging = false;
    this.longPressTriggered = false;
    this.pressStartTime = Date.now();
    this.pressStartPoint = point;
    this.lastPoint = point;

    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      if (!this.active || this.dragging || this.longPressTriggered) {
        return;
      }
      this.longPressTriggered = true;
      const duration = Date.now() - this.pressStartTime;
      for (const callback of this.longPressCallbacks) {
        callback(duration);
      }
    }, InputManager.LONG_PRESS_MS);
  }

  private moveInteraction(clientX: number, clientY: number): void {
    if (!this.active) {
      return;
    }

    const point = this.toLogicalPoint(clientX, clientY);
    this.lastPoint = point;

    if (!this.dragging) {
      const dx = point.x - this.pressStartPoint.x;
      const dy = point.y - this.pressStartPoint.y;
      const isDragStart =
        dx * dx + dy * dy >= InputManager.DRAG_THRESHOLD * InputManager.DRAG_THRESHOLD;
      if (isDragStart) {
        this.dragging = true;
        this.clearLongPressTimer();
        for (const handler of this.dragHandlers) {
          handler.startCb(point.x, point.y);
        }
      }
    }

    if (this.dragging) {
      for (const handler of this.dragHandlers) {
        handler.moveCb(point.x, point.y);
      }
    }
  }

  private endInteraction(clientX: number, clientY: number): void {
    if (!this.active) {
      return;
    }

    const point = this.toLogicalPoint(clientX, clientY);
    const duration = Date.now() - this.pressStartTime;

    this.clearLongPressTimer();

    if (this.dragging) {
      for (const handler of this.dragHandlers) {
        handler.endCb(point.x, point.y);
      }
    } else if (!this.longPressTriggered && duration < InputManager.LONG_PRESS_MS) {
      for (const callback of this.tapCallbacks) {
        callback(point.x, point.y);
      }
    }

    this.resetInteractionState();
  }

  private cancelInteraction(): void {
    this.clearLongPressTimer();
    this.resetInteractionState();
  }

  private resetInteractionState(): void {
    this.active = false;
    this.activeTouchId = null;
    this.dragging = false;
    this.longPressTriggered = false;
    this.pressStartTime = 0;
  }

  private clearLongPressTimer(): void {
    if (!this.longPressTimer) {
      return;
    }
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  private toLogicalPoint(clientX: number, clientY: number): LogicalPoint {
    if (!this.canvasElement) {
      return { x: 0, y: 0 };
    }

    const rect = this.canvasElement.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 1;
    const height = rect.height > 0 ? rect.height : 1;

    const normalizedX = this.clamp((clientX - rect.left) / width, 0, 1);
    const normalizedY = this.clamp((clientY - rect.top) / height, 0, 1);

    return {
      x: normalizedX * this.logicalWidth,
      y: (1 - normalizedY) * this.logicalHeight,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 || this.active) {
      return;
    }
    this.beginInteraction(event.clientX, event.clientY);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.active) {
      return;
    }
    this.moveInteraction(event.clientX, event.clientY);
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }
    this.endInteraction(event.clientX, event.clientY);
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    if (this.active || event.changedTouches.length === 0) {
      return;
    }
    const touch = event.changedTouches[0];
    this.activeTouchId = touch.identifier;
    this.beginInteraction(touch.clientX, touch.clientY);
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (!this.active || this.activeTouchId === null) {
      return;
    }
    const touch = this.findTouchById(event.changedTouches, this.activeTouchId);
    if (!touch) {
      return;
    }
    this.moveInteraction(touch.clientX, touch.clientY);
  };

  private readonly handleTouchEnd = (event: TouchEvent): void => {
    if (!this.active || this.activeTouchId === null) {
      return;
    }
    const touch = this.findTouchById(event.changedTouches, this.activeTouchId);
    if (!touch) {
      return;
    }
    this.endInteraction(touch.clientX, touch.clientY);
  };

  private readonly handleTouchCancel = (event: TouchEvent): void => {
    if (!this.active || this.activeTouchId === null) {
      return;
    }
    const touch = this.findTouchById(event.changedTouches, this.activeTouchId);
    if (!touch) {
      return;
    }
    this.cancelInteraction();
  };

  private findTouchById(touchList: TouchList, touchId: number): Touch | null {
    for (let i = 0; i < touchList.length; i += 1) {
      const touch = touchList.item(i);
      if (touch && touch.identifier === touchId) {
        return touch;
      }
    }
    return null;
  }
}
