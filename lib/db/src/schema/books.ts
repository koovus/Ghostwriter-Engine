import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  genre: text("genre").notNull().default(""),
  audience: text("audience").notNull().default(""),
  logline: text("logline").notNull().default(""),
  rawOutlineMd: text("raw_outline_md").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  beatsJson: json("beats_json").$type<string[]>().notNull().default([]),
  generatedText: text("generated_text"),
  wordCount: integer("word_count").notNull().default(0),
  openerTechnique: text("opener_technique"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const toneSamplesTable = pgTable("tone_samples", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Writing sample"),
  sampleText: text("sample_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;

export const insertChapterSchema = createInsertSchema(chaptersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;

export const insertToneSampleSchema = createInsertSchema(toneSamplesTable).omit(
  { id: true, createdAt: true }
);
export type InsertToneSample = z.infer<typeof insertToneSampleSchema>;
export type ToneSample = typeof toneSamplesTable.$inferSelect;
