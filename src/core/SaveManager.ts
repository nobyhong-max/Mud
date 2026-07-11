import { Item } from "../player/Player";

export interface SaveData {
  version: "1.0";
  player: {
    id: string;
    x: number;
    y: number;
    hp: number;
    stamina: number;
    level: number;
    inventory: Array<Item | null>;
    equipped: Record<string, Item | null>;
  };
  scene: {
    currentSceneId: string;
    discoveredRooms: string[];
  };
  timestamp: number;
}

export type SaveErrorCode =
  | "OK"
  | "NO_DATA"
  | "STORAGE_UNAVAILABLE"
  | "SERIALIZE_ERROR"
  | "DESERIALIZE_ERROR"
  | "INVALID_SCHEMA"
  | "CLOUD_STUB_EMPTY"
  | "UNKNOWN_ERROR";

export interface SaveOperationResult {
  ok: boolean;
  code: SaveErrorCode;
  message: string;
}

export class SaveManager {
  private static readonly LOCAL_KEY = "mud.save.local.v1";
  private static readonly CLOUD_STUB_KEY = "mud.save.cloud.stub.v1";
  private static cloudStubCache = "";

  private lastResult: SaveOperationResult = {
    ok: true,
    code: "OK",
    message: "idle",
  };

  public getLastResult(): SaveOperationResult {
    return {
      ok: this.lastResult.ok,
      code: this.lastResult.code,
      message: this.lastResult.message,
    };
  }

  public async saveLocal(saveData: SaveData): Promise<boolean> {
    try {
      const storage = this.getStorage();
      storage.setItem(SaveManager.LOCAL_KEY, JSON.stringify(saveData));
      this.setResult(true, "OK", "local save success");
      return true;
    } catch (error: unknown) {
      return this.handleSaveError(error, "save local failed");
    }
  }

  public async loadLocal(): Promise<SaveData | null> {
    try {
      const storage = this.getStorage();
      const raw = storage.getItem(SaveManager.LOCAL_KEY);
      if (!raw) {
        this.setResult(false, "NO_DATA", "local save not found");
        return null;
      }
      return this.parseAndValidate(raw, "load local failed");
    } catch (error: unknown) {
      this.handleLoadError(error, "load local failed");
      return null;
    }
  }

  public async saveCloudStub(saveData: SaveData): Promise<boolean> {
    try {
      const payload = JSON.stringify(saveData);
      SaveManager.cloudStubCache = payload;
      const storage = this.tryGetStorage();
      storage?.setItem(SaveManager.CLOUD_STUB_KEY, payload);
      this.setResult(true, "OK", "cloud stub save success");
      return true;
    } catch (error: unknown) {
      return this.handleSaveError(error, "save cloud stub failed");
    }
  }

  public async loadCloudStub(): Promise<SaveData | null> {
    try {
      const storage = this.tryGetStorage();
      const rawFromStorage = storage?.getItem(SaveManager.CLOUD_STUB_KEY) ?? "";
      const raw = rawFromStorage || SaveManager.cloudStubCache;
      if (!raw) {
        this.setResult(false, "CLOUD_STUB_EMPTY", "cloud stub is empty");
        return null;
      }
      return this.parseAndValidate(raw, "load cloud stub failed");
    } catch (error: unknown) {
      this.handleLoadError(error, "load cloud stub failed");
      return null;
    }
  }

  private parseAndValidate(raw: string, fallbackMessage: string): SaveData | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!this.isSaveData(parsed)) {
        this.setResult(false, "INVALID_SCHEMA", `${fallbackMessage}: invalid schema`);
        return null;
      }
      this.setResult(true, "OK", "load success");
      return parsed;
    } catch (error: unknown) {
      this.handleLoadError(error, fallbackMessage);
      return null;
    }
  }

  private isSaveData(value: unknown): value is SaveData {
    if (!value || typeof value !== "object") {
      return false;
    }
    const data = value as Partial<SaveData>;
    if (data.version !== "1.0" || typeof data.timestamp !== "number") {
      return false;
    }
    if (!data.player || !data.scene) {
      return false;
    }
    if (
      typeof data.player.id !== "string" ||
      typeof data.player.x !== "number" ||
      typeof data.player.y !== "number" ||
      typeof data.player.hp !== "number" ||
      typeof data.player.stamina !== "number" ||
      typeof data.player.level !== "number"
    ) {
      return false;
    }
    if (
      !Array.isArray(data.player.inventory) ||
      !data.player.equipped ||
      typeof data.player.equipped !== "object"
    ) {
      return false;
    }
    if (
      typeof data.scene.currentSceneId !== "string" ||
      !Array.isArray(data.scene.discoveredRooms)
    ) {
      return false;
    }
    return true;
  }

  private getStorage(): Storage {
    const storage = this.tryGetStorage();
    if (!storage) {
      throw new Error("localStorage unavailable");
    }
    return storage;
  }

  private tryGetStorage(): Storage | null {
    if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
      return null;
    }
    return globalThis.localStorage;
  }

  private setResult(ok: boolean, code: SaveErrorCode, message: string): void {
    this.lastResult = { ok, code, message };
  }

  private handleSaveError(error: unknown, fallbackMessage: string): false {
    const message = this.errorMessage(error, fallbackMessage);
    const code: SaveErrorCode = message.includes("localStorage unavailable")
      ? "STORAGE_UNAVAILABLE"
      : error instanceof TypeError
        ? "SERIALIZE_ERROR"
      : message.includes("JSON")
        ? "SERIALIZE_ERROR"
        : "UNKNOWN_ERROR";
    this.setResult(false, code, message);
    return false;
  }

  private handleLoadError(error: unknown, fallbackMessage: string): void {
    const message = this.errorMessage(error, fallbackMessage);
    const code: SaveErrorCode = message.includes("localStorage unavailable")
      ? "STORAGE_UNAVAILABLE"
      : error instanceof SyntaxError
        ? "DESERIALIZE_ERROR"
      : message.includes("JSON")
        ? "DESERIALIZE_ERROR"
        : "UNKNOWN_ERROR";
    this.setResult(false, code, message);
  }

  private errorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallbackMessage;
  }
}
