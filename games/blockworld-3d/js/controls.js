export class Controls {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.mode = "mine";
    this.move = { x: 0, y: 0 };
    this.jump = false;
    this.sneak = false;
    this.mine = false;
    this.place = false;
    this.use = false;
    this.uiBlocked = false;
    this.lookDelta = { x: 0, y: 0 };
    this.pointerLocked = false;
    this.touchLook = { active: false, lastX: 0, lastY: 0 };

    this.bindKeyboard();
    this.bindPointer();
    this.bindTouch();
    this.bindJoystick();
  }

  setMode(mode) {
    this.mode = mode;
  }

  bindKeyboard() {
    this.keys = new Set();
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 5) this.hotbarKey = n - 1;
      }
      if (e.code === "KeyR") this.flyToggle = true;
      if (e.code === "KeyV") this.viewToggle = true;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  bindPointer() {
    this.canvas.addEventListener("click", () => {
      if (this.uiBlocked) return;
      if (!this.pointerLocked) this.canvas.requestPointerLock?.();
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked || this.uiBlocked) return;
      this.lookDelta.x += e.movementX;
      this.lookDelta.y += e.movementY;
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.uiBlocked) return;
      if (e.button === 0) {
        if (this.mode === "mine") this.mine = true;
        else if (this.mode === "place") this.place = true;
        else this.usePulse = true;
      }
      if (e.button === 2 && this.mode === "place") this.place = true;
    });
    window.addEventListener("mouseup", () => {
      this.mine = false;
      this.place = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  bindTouch() {
    const lookZone = document.getElementById("look-zone");
    lookZone?.addEventListener("pointerdown", (e) => {
      if (this.uiBlocked) return;
      this.touchLook.active = true;
      this.touchLook.lastX = e.clientX;
      this.touchLook.lastY = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
    });
    lookZone?.addEventListener("pointermove", (e) => {
      if (!this.touchLook.active) return;
      this.lookDelta.x += (e.clientX - this.touchLook.lastX) * 0.35;
      this.lookDelta.y += (e.clientY - this.touchLook.lastY) * 0.35;
      this.touchLook.lastX = e.clientX;
      this.touchLook.lastY = e.clientY;
    });
    const endLook = (e) => {
      this.touchLook.active = false;
      lookZone?.releasePointerCapture?.(e.pointerId);
    };
    lookZone?.addEventListener("pointerup", endLook);
    lookZone?.addEventListener("pointercancel", endLook);

    document.getElementById("btn-mine-mobile")?.addEventListener("pointerdown", () => {
      if (this.mode === "mine") this.mine = true;
    });
    document.getElementById("btn-place-mobile")?.addEventListener("pointerdown", () => {
      if (this.mode === "place") this.place = true;
    });
    document.getElementById("btn-mine-mobile")?.addEventListener("pointerup", () => {
      this.mine = false;
    });
    document.getElementById("btn-place-mobile")?.addEventListener("pointerup", () => {
      this.place = false;
    });
  }

  bindJoystick() {
    const joy = this.ui.joystick;
    if (!joy) return;
    const knob = joy.querySelector(".knob");
    let pid = null;
    let cx = 0;
    let cy = 0;
    const maxR = 42;
    const reset = () => {
      this.move.x = 0;
      this.move.y = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };
    joy.addEventListener("pointerdown", (e) => {
      if (this.uiBlocked) return;
      pid = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      joy.setPointerCapture(pid);
      update(e);
    });
    joy.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      update(e);
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      reset();
    };
    joy.addEventListener("pointerup", end);
    joy.addEventListener("pointercancel", end);

    const update = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d > maxR) {
        dx = (dx / d) * maxR;
        dy = (dy / d) * maxR;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.move.x = dx / maxR;
      this.move.y = -dy / maxR;
    };
  }

  poll() {
    const flyToggle = this.flyToggle;
    const viewToggle = this.viewToggle;
    const hotbarKey = this.hotbarKey;
    this.flyToggle = false;
    this.viewToggle = false;
    this.hotbarKey = undefined;

    if (!this.uiBlocked && !this.touchLook.active) {
      let mx = 0;
      let my = 0;
      if (this.keys?.has("KeyW") || this.keys?.has("ArrowUp")) my += 1;
      if (this.keys?.has("KeyS") || this.keys?.has("ArrowDown")) my -= 1;
      if (this.keys?.has("KeyA") || this.keys?.has("ArrowLeft")) mx -= 1;
      if (this.keys?.has("KeyD") || this.keys?.has("ArrowRight")) mx += 1;
      if (mx || my) {
        const len = Math.hypot(mx, my) || 1;
        this.move.x = mx / len;
        this.move.y = my / len;
      } else if (!this.ui.joystick?.querySelector(".knob")) {
        /* joystick sets move */
      }
    }

    this.jump =
      this.keys?.has("Space") ||
      this.ui.jumpBtn?.classList.contains("active") ||
      this.ui.jumpBtn?.matches(":active");
    this.sneak = this.keys?.has("ShiftLeft") || this.keys?.has("ShiftRight");
    if (this.ui.jumpBtn) {
      /* jump btn toggled via touch handlers in main */
    }
    const use = this.usePulse;
    this.usePulse = false;
    return { flyToggle, viewToggle, hotbarKey, use };
  }

  consumeLook(sensitivity = 0.0022) {
    const dx = this.lookDelta.x * sensitivity;
    const dy = this.lookDelta.y * sensitivity;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return { dx, dy };
  }
}
