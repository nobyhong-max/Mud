export class Input {
  constructor(canvas, joystickEl, jumpBtn) {
    this.left = false;
    this.right = false;
    this.jump = false;
    this.mine = false;
    this.place = false;
    this.mode = "mine";
    this.pointerWorld = { x: 0, y: 0, active: false };
    this.keys = new Set();
    this.hotbarKey = undefined;
    this.jumpHeld = false;

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));

    canvas.addEventListener("pointerdown", (e) => this.onPointer(e, canvas, true));
    canvas.addEventListener("pointermove", (e) => this.onPointer(e, canvas, false));
    canvas.addEventListener("pointerup", () => {
      this.mine = false;
      this.place = false;
    });
    canvas.addEventListener("pointercancel", () => {
      this.mine = false;
      this.place = false;
    });

    this.joystick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    if (joystickEl) this.bindJoystick(joystickEl);
    if (jumpBtn) {
      jumpBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.jumpHeld = true;
      });
      jumpBtn.addEventListener("pointerup", () => {
        this.jumpHeld = false;
      });
      jumpBtn.addEventListener("pointerleave", () => {
        this.jumpHeld = false;
      });
    }
  }

  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (["arrowleft", "a", "arrowright", "d", " ", "w", "arrowup", "1", "2", "3", "4", "5", "f"].includes(k)) {
      e.preventDefault();
    }
    if (down) this.keys.add(k);
    else this.keys.delete(k);

    if (k === "f" && down) this.mode = this.mode === "mine" ? "place" : "mine";
    if (k >= "1" && k <= "5" && down) this.hotbarKey = Number(k) - 1;
  }

  bindJoystick(el) {
    const knob = el.querySelector(".knob");
    const base = el.querySelector(".base") || el;
    const maxR = 36;

    const reset = () => {
      this.joystick.active = false;
      this.joystick.x = 0;
      this.joystick.y = 0;
      if (knob) knob.style.transform = "translate(-50%, -50%)";
    };

    base.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      base.setPointerCapture(e.pointerId);
      const rect = base.getBoundingClientRect();
      this.joystick.active = true;
      this.joystick.ox = rect.left + rect.width / 2;
      this.joystick.oy = rect.top + rect.height / 2;
      this.moveKnob(e.clientX, e.clientY);
    });

    base.addEventListener("pointermove", (e) => {
      if (!this.joystick.active) return;
      this.moveKnob(e.clientX, e.clientY);
    });

    const end = (e) => {
      if (base.hasPointerCapture?.(e.pointerId)) base.releasePointerCapture(e.pointerId);
      reset();
    };
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);

    this.moveKnob = (cx, cy) => {
      let dx = cx - this.joystick.ox;
      let dy = cy - this.joystick.oy;
      const len = Math.hypot(dx, dy);
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      this.joystick.x = dx / maxR;
      this.joystick.y = dy / maxR;
      if (knob) {
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    };
  }

  onPointer(e, canvas, isDown) {
    const rect = canvas.getBoundingClientRect();
    this.pointerWorld.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    this.pointerWorld.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    this.pointerWorld.active = true;
    if (isDown) {
      if (this.mode === "place") this.place = true;
      else this.mine = true;
    }
  }

  poll() {
    this.left = this.keys.has("arrowleft") || this.keys.has("a") || this.joystick.x < -0.25;
    this.right = this.keys.has("arrowright") || this.keys.has("d") || this.joystick.x > 0.25;
    this.jump =
      this.jumpHeld ||
      this.keys.has(" ") ||
      this.keys.has("w") ||
      this.keys.has("arrowup");

    const hk = this.hotbarKey;
    this.hotbarKey = undefined;
    return { hotbarKey: hk };
  }
}
