import mongoose from "mongoose";

/**
 * Conversation privée entre deux amis (section 7). Une seule par paire
 * (`pairKey`). `reads` garde, pour chaque participant, la date de sa dernière
 * lecture : les messages plus récents reçus de l'autre sont « non lus ».
 */
const schema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: { validator: (ids) => ids.length === 2, message: "Une conversation a exactement deux participants" },
    },
    pairKey: { type: String, required: true, unique: true },
    reads: {
      type: [{ _id: false, userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, lastReadAt: Date }],
      default: [],
    },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model("Conversation", schema);
