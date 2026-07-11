export type InteractableType = "npc" | "container" | "object";

export type ContextAction = {
  label: string;
  handler: () => Promise<string>;
};

export abstract class Interactable {
  public readonly id: string;
  public readonly type: InteractableType;
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(params: {
    id: string;
    type: InteractableType;
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    this.id = params.id;
    this.type = params.type;
    this.x = params.x;
    this.y = params.y;
    this.width = params.width;
    this.height = params.height;
  }

  public abstract getContextAction(): ContextAction;
}
