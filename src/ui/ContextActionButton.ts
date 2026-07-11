import {
  _decorator,
  Button,
  Color,
  Component,
  Label,
  Node,
  Sprite,
  UITransform,
  Vec3,
  Widget,
  tween,
} from "cc";
import { Interactable } from "../entities/Interactable";

const { ccclass } = _decorator;

@ccclass("ContextActionButton")
export class ContextActionButton extends Component {
  public static readonly EVENT_ACTION_RESULT = "context-action-result";

  private target: Interactable | null = null;
  private label: Label | null = null;
  private button: Button | null = null;
  private running = false;

  onLoad(): void {
    this.ensureButtonNode();
    this.hide();
  }

  public setContext(target: Interactable | null): void {
    this.target = target;
    if (!target) {
      this.hide();
      return;
    }

    const action = target.getContextAction();
    if (this.label) {
      this.label.string = action.label;
    }
    this.show();
  }

  public show(): void {
    this.node.active = true;
  }

  public hide(): void {
    this.node.active = false;
  }

  private ensureButtonNode(): void {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }
    transform.setContentSize(156, 56);

    let sprite = this.node.getComponent(Sprite);
    if (!sprite) {
      sprite = this.node.addComponent(Sprite);
    }
    sprite.color = new Color(58, 120, 72, 245);

    let widget = this.node.getComponent(Widget);
    if (!widget) {
      widget = this.node.addComponent(Widget);
    }
    widget.isAlignBottom = true;
    widget.isAlignRight = true;
    widget.bottom = 16;
    widget.right = 16;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    this.button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
    this.node.on(Button.EventType.CLICK, this.onClick, this);

    const labelNode = new Node("ContextLabel");
    const label = labelNode.addComponent(Label);
    label.fontSize = 20;
    label.lineHeight = 21;
    label.color = Color.WHITE;
    label.string = "交互";
    labelNode.setPosition(new Vec3(0, 0, 0));
    this.node.addChild(labelNode);
    this.label = label;
  }

  private async onClick(): Promise<void> {
    if (!this.target || this.running) {
      return;
    }

    this.runClickFeedback();
    this.running = true;
    try {
      const action = this.target.getContextAction();
      const result = await action.handler();
      this.node.emit(
        ContextActionButton.EVENT_ACTION_RESULT,
        result || `${action.label} 完成。`
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "未知异常";
      this.node.emit(ContextActionButton.EVENT_ACTION_RESULT, `动作失败：${reason}`);
    } finally {
      this.running = false;
    }
  }

  private runClickFeedback(): void {
    tween(this.node)
      .stop()
      .to(0.07, { scale: new Vec3(0.92, 0.92, 1) })
      .to(0.12, { scale: new Vec3(1, 1, 1) })
      .start();
  }
}
