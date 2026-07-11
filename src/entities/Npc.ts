import { ContextAction, Interactable } from "./Interactable";

export class Npc extends Interactable {
  public readonly name: string;
  public readonly dialogueLines: string[];
  private dialogueIndex = 0;

  constructor(params: {
    id: string;
    name: string;
    dialogueLines: string[];
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    super({
      id: params.id,
      type: "npc",
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height,
    });
    this.name = params.name;
    this.dialogueLines = [...params.dialogueLines];
  }

  public getContextAction(): ContextAction {
    return {
      label: `与${this.name}交谈`,
      handler: async () => this.nextDialogueBubble(),
    };
  }

  private nextDialogueBubble(): string {
    if (this.dialogueLines.length === 0) {
      return `${this.name}看起来暂时不想说话。`;
    }
    const line = this.dialogueLines[this.dialogueIndex];
    this.dialogueIndex = (this.dialogueIndex + 1) % this.dialogueLines.length;
    return `${this.name}：${line}`;
  }
}
