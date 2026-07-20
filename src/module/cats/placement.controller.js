import { db } from "../../config/db.js";
import { catPlacementsTable, userInventoryTable } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

// Get all cat placements for the logged-in user
export const getUserPlacements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const placements = await db
      .select({
        id: catPlacementsTable.id,
        slotIndex: catPlacementsTable.slotIndex,
        cat: catPlacementsTable.catData,
      })
      .from(catPlacementsTable)
      .where(eq(catPlacementsTable.userId, userId));

    res.json(placements);
  } catch (error) {
    console.error("Get User Placements Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Place or update a cat in a slot
export const placeCat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cat, slotIndex } = req.body;

    if (cat === undefined || slotIndex === undefined) {
      return res.status(400).json({ error: "cat object and slotIndex are required" });
    }

    if (slotIndex < 0 || slotIndex > 47) {
      return res.status(400).json({ error: "slotIndex must be between 0 and 47" });
    }

    // Check if slot is already occupied by this user
    const existing = await db
      .select()
      .from(catPlacementsTable)
      .where(
        and(
          eq(catPlacementsTable.userId, userId),
          eq(catPlacementsTable.slotIndex, slotIndex)
        )
      )
      .limit(1);

    // If we are placing a cat, delete it from user inventory (since it is now placed on a desk)
    if (cat.id) {
      await db.delete(userInventoryTable)
        .where(
          and(
            eq(userInventoryTable.id, cat.id),
            eq(userInventoryTable.userId, userId)
          )
        );
    }

    let placement;
    if (existing.length > 0) {
      // Update placement
      const [updated] = await db
        .update(catPlacementsTable)
        .set({
          catData: cat,
          updatedAt: new Date(),
        })
        .where(eq(catPlacementsTable.id, existing[0].id))
        .returning();
      placement = updated;
    } else {
      // Insert placement
      const [inserted] = await db
        .insert(catPlacementsTable)
        .values({
          userId,
          catData: cat,
          slotIndex,
        })
        .returning();
      placement = inserted;
    }

    res.json({
      message: "Cat placed successfully",
      placement,
    });
  } catch (error) {
    console.error("Place Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Recall/pickup a cat from a slot
export const pickupCat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { slotIndex } = req.params;
    const slotIdx = parseInt(slotIndex, 10);

    if (isNaN(slotIdx) || slotIdx < 0 || slotIdx > 47) {
      return res.status(400).json({ error: "Invalid slotIndex" });
    }

    const [deleted] = await db
      .delete(catPlacementsTable)
      .where(
        and(
          eq(catPlacementsTable.userId, userId),
          eq(catPlacementsTable.slotIndex, slotIdx)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "No cat found in this slot" });
    }

    // Insert the cat back to user inventory
    const catId = deleted.catData?.catId || deleted.catData?.id;
    if (catId) {
      await db.insert(userInventoryTable).values({
        userId,
        catId: parseInt(catId, 10),
      });
    }

    res.json({
      message: "Cat picked up successfully",
      placement: deleted,
    });
  } catch (error) {
    console.error("Pickup Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};
