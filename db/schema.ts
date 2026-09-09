import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  volunteer: text("volunteer").notNull().default("Volunteer"),
  volunteerEmail: text("volunteer_email").notNull().default(""),
  location: text("location").notNull(),
  wasteType: text("waste_type").notNull(),
  notes: text("notes").notNull().default(""),
  beforeKey: text("before_key").notNull(),
  afterKey: text("after_key"),
  center: text("center"),
  weight: real("weight"),
  credits: integer("credits").notNull().default(0),
  status: text("status").notNull().default("awaiting_cleanup"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creditLedger = sqliteTable("credit_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amount: integer("amount").notNull(),
  kind: text("kind").notNull(),
  detail: text("detail").notNull(),
  volunteerEmail: text("volunteer_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const redemptions = sqliteTable("redemptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rewardId: text("reward_id").notNull(),
  rewardName: text("reward_name").notNull(),
  credits: integer("credits").notNull(),
  code: text("code").notNull(),
  volunteerEmail: text("volunteer_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
