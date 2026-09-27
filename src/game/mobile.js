/**
 * Virtual joystick + look pad + action buttons for SpikeTactics mobile.
 * Does not require Pointer Lock.
 */

const LOOK_SENS = 0.0028;

export class MobileControls {
  /**
   * @param {object} opts
   * @param {(dx:number, dy:number)=>void} opts.onLook
   * @param {(active:boolean)=>void} opts.onFire
   * @param {()=>void} opts.onReload
   * @param {(down:boolean)=>void} opts.onJump
   * @param {(down:boolean)=>void} opts.onSprint
   * @param {(slot:string)=>void} opts.onAbility
   * @param {(down:boolean)=>void} opts.onInteract
   * @param {()=>void} opts.onBuy
   */
  constructor(opts) {
    this.opts = opts;
    this.move = { x: 0, y: 0 };
    this.enabled = false;
    this.root = document.getElementById('mobile-controls');
    this.joyBase = document.getElementById('joy-base');
    this.joyKnob = document.getElementById('joy-knob');
    this.lookPad = document.getElementById('look-pad');

    this._joyId = null;
    this._lookId = null;
    this._joyOrigin = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };
    this._radius = 54;

    this._bind();
  }

  setVisible(on) {
    this.enabled = on;
    this.root?.classList.toggle('hidden', !on);
    if (!on) {
      this.move.x = 0;
      this.move.y = 0;
      this._resetJoy();
      this.opts.onFire?.(false);
      this.opts.onInteract?.(false);
      this.opts.onSprint?.(false);
      this.opts.onJump?.(false);
    }
  }

  _bind() {
    if (!this.root) return;

    // Joystick
    const joyStart = (e) => {
      if (!this.enabled) return;
      const t = e.changedTouches[0];
      if (this._joyId != null) return;
      this._joyId = t.identifier;
      const r = this.joyBase.getBoundingClientRect();
      this._radius = Math.min(r.width, r.height) * 0.42;
      this._joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this._updateJoy(t.clientX, t.clientY);
      e.preventDefault();
    };
    const joyMove = (e) => {
      if (this._joyId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._updateJoy(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      }
    };
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._joyId = null;
          this.move.x = 0;
          this.move.y = 0;
          this._resetJoy();
          e.preventDefault();
          break;
        }
      }
    };
    this.joyBase.addEventListener('touchstart', joyStart, { passive: false });
    this.joyBase.addEventListener('touchmove', joyMove, { passive: false });
    this.joyBase.addEventListener('touchend', joyEnd, { passive: false });
    this.joyBase.addEventListener('touchcancel', joyEnd, { passive: false });

    // Look pad (right side drag)
    const lookStart = (e) => {
      if (!this.enabled) return;
      // ignore if started on a button
      if (e.target.closest('.mc-btn')) return;
      const t = e.changedTouches[0];
      if (this._lookId != null) return;
      this._lookId = t.identifier;
      this._lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };
    const lookMove = (e) => {
      if (this._lookId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) {
          const dx = t.clientX - this._lookLast.x;
          const dy = t.clientY - this._lookLast.y;
          this._lookLast = { x: t.clientX, y: t.clientY };
          this.opts.onLook?.(dx * LOOK_SENS, dy * LOOK_SENS);
          e.preventDefault();
          break;
        }
      }
    };
    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) {
          this._lookId = null;
          e.preventDefault();
          break;
        }
      }
    };
    this.lookPad.addEventListener('touchstart', lookStart, { passive: false });
    this.lookPad.addEventListener('touchmove', lookMove, { passive: false });
    this.lookPad.addEventListener('touchend', lookEnd, { passive: false });
    this.lookPad.addEventListener('touchcancel', lookEnd, { passive: false });

    const hold = (sel, down, up) => {
      const el = this.root.querySelector(sel);
      if (!el) return;
      const onDown = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        down();
      };
      const onUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        up?.();
      };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend', onUp, { passive: false });
      el.addEventListener('touchcancel', onUp, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); down(); });
      el.addEventListener('mouseup', () => up?.());
      el.addEventListener('mouseleave', () => up?.());
    };

    hold('#mc-fire', () => this.opts.onFire?.(true), () => this.opts.onFire?.(false));
    hold('#mc-interact', () => this.opts.onInteract?.(true), () => this.opts.onInteract?.(false));
    hold('#mc-jump', () => this.opts.onJump?.(true), () => this.opts.onJump?.(false));
    hold('#mc-sprint', () => this.opts.onSprint?.(true), () => this.opts.onSprint?.(false));
    hold('#mc-reload', () => this.opts.onReload?.(), null);
    hold('#mc-buy', () => this.opts.onBuy?.(), null);
    hold('#mc-q', () => this.opts.onAbility?.('q'), null);
    hold('#mc-e', () => this.opts.onAbility?.('e'), null);
    hold('#mc-c', () => this.opts.onAbility?.('c'), null);
    hold('#mc-x', () => this.opts.onAbility?.('x'), null);
  }

  _updateJoy(cx, cy) {
    let dx = cx - this._joyOrigin.x;
    let dy = cy - this._joyOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this._radius);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.move.x = dx / this._radius;
    this.move.y = -dy / this._radius; // forward = up
  }

  _resetJoy() {
    if (this.joyKnob) this.joyKnob.style.transform = 'translate(0, 0)';
  }
}
