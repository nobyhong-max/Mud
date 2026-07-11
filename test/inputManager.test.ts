import { InputManager } from "../src/core/InputManager";

describe("InputManager", () => {
  const logicalWidth = 360;
  const logicalHeight = 200;
  const managers: InputManager[] = [];

  function createCanvas(): HTMLDivElement {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () =>
        ({
          left: 0,
          top: 0,
          width: logicalWidth,
          height: logicalHeight,
        }) as DOMRect,
    });
    document.body.appendChild(canvas);
    return canvas;
  }

  function dispatchMouse(
    target: EventTarget,
    type: "mousedown" | "mousemove" | "mouseup",
    x: number,
    y: number
  ): void {
    target.dispatchEvent(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        bubbles: true,
      })
    );
  }

  afterEach(() => {
    for (const manager of managers) {
      manager.destroy();
    }
    managers.length = 0;
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  it("triggers tap callback with logical coordinates", () => {
    const manager = new InputManager(logicalWidth, logicalHeight);
    managers.push(manager);
    const canvas = createCanvas();
    manager.init(canvas);

    const tapSpy = jest.fn();
    manager.onTap(tapSpy);

    dispatchMouse(canvas, "mousedown", 180, 100);
    dispatchMouse(window, "mouseup", 180, 100);

    expect(tapSpy).toHaveBeenCalledTimes(1);
    expect(tapSpy).toHaveBeenCalledWith(180, 100);
  });

  it("triggers long press callback after threshold", () => {
    jest.useFakeTimers();
    const manager = new InputManager(logicalWidth, logicalHeight);
    managers.push(manager);
    const canvas = createCanvas();
    manager.init(canvas);

    const longPressSpy = jest.fn();
    manager.onLongPress(longPressSpy);

    dispatchMouse(canvas, "mousedown", 20, 20);
    jest.advanceTimersByTime(InputManager.LONG_PRESS_MS + 30);

    expect(longPressSpy).toHaveBeenCalledTimes(1);
    const durationArg = longPressSpy.mock.calls[0][0] as number;
    expect(durationArg).toBeGreaterThanOrEqual(InputManager.LONG_PRESS_MS);

    dispatchMouse(window, "mouseup", 20, 20);
  });

  it("triggers drag start/move/end callbacks", () => {
    const manager = new InputManager(logicalWidth, logicalHeight);
    managers.push(manager);
    const canvas = createCanvas();
    manager.init(canvas);

    const startSpy = jest.fn();
    const moveSpy = jest.fn();
    const endSpy = jest.fn();
    manager.onDrag(startSpy, moveSpy, endSpy);

    dispatchMouse(canvas, "mousedown", 10, 180);
    dispatchMouse(canvas, "mousemove", 80, 140);
    dispatchMouse(canvas, "mousemove", 120, 120);
    dispatchMouse(window, "mouseup", 120, 120);

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(moveSpy).toHaveBeenCalled();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });
});
