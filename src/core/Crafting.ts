import { Item, ItemType } from "../player/Player";

export type CraftRecipe = {
  name: string;
  ingredients: Array<{ id: string; qty: number }>;
  result: { id: string; name: string; qty: number; type?: ItemType };
};

export type CraftResult = {
  success: boolean;
  message: string;
  recipe?: CraftRecipe;
  resultItem?: Item;
};

export class Crafting {
  public static readonly RECIPES: CraftRecipe[] = [
    {
      name: "mud-ball",
      ingredients: [
        { id: "mud", qty: 1 },
        { id: "water", qty: 1 },
      ],
      result: { id: "mud-ball", name: "泥球", qty: 1, type: "material" },
    },
  ];

  public static checkRecipe(
    ingredients: Array<{ id: string; qty: number }>
  ): CraftRecipe | null {
    for (const recipe of Crafting.RECIPES) {
      if (Crafting.matchesIngredients(recipe, ingredients)) {
        return recipe;
      }
    }
    return null;
  }

  public static tryCraft(
    ingredients: Array<{ id: string; qty: number }>
  ): CraftResult {
    const recipe = Crafting.checkRecipe(ingredients);
    if (!recipe) {
      return {
        success: false,
        message: "配方不匹配，无法合成。",
      };
    }

    return {
      success: true,
      message: `合成成功：${recipe.result.name}`,
      recipe,
      resultItem: {
        id: recipe.result.id,
        name: recipe.result.name,
        qty: recipe.result.qty,
        type: recipe.result.type ?? "material",
      },
    };
  }

  public static tryCraftByItems(first: Item, second: Item): CraftResult {
    return Crafting.tryCraft([
      { id: first.id, qty: 1 },
      { id: second.id, qty: 1 },
    ]);
  }

  private static matchesIngredients(
    recipe: CraftRecipe,
    ingredients: Array<{ id: string; qty: number }>
  ): boolean {
    if (recipe.ingredients.length !== ingredients.length) {
      return false;
    }

    const counts = new Map<string, number>();
    for (const ingredient of ingredients) {
      counts.set(ingredient.id, (counts.get(ingredient.id) ?? 0) + ingredient.qty);
    }

    for (const needed of recipe.ingredients) {
      const actual = counts.get(needed.id) ?? 0;
      if (actual < needed.qty) {
        return false;
      }
    }

    return true;
  }
}
