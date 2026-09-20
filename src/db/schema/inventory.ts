/**
 * Inventory Management Schema
 * warehouses, inventory_categories, inventory_products, inventory_stock,
 * inventory_transactions, suppliers, purchase_orders, purchase_items, stock_adjustments
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, integer, boolean, timestamp, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';

// =============================================
// WAREHOUSES / STORE LOCATIONS
// =============================================
export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  address: text('address'),
  status: text('status', { enum: ['Active', 'Inactive'] }).notNull().default('Active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('warehouse_org_code_uniq').on(table.organizationId, table.code),
  index('warehouse_org_idx').on(table.organizationId),
]);

// =============================================
// INVENTORY CATEGORIES
// =============================================
export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),                        // self-ref
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('inv_cat_org_code_uniq').on(table.organizationId, table.code),
  index('inv_cat_org_idx').on(table.organizationId),
]);

// =============================================
// INVENTORY PRODUCTS (catalog)
// =============================================
export const inventoryProducts = pgTable('inventory_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => inventoryCategories.id),
  itemCode: text('item_code').notNull(),               // unique per org
  name: text('name').notNull(),
  unit: text('unit').notNull(),                       // pcs, boxes, rims
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull().default('0'),
  minStockLevel: integer('min_stock_level').notNull().default(0),
  status: text('status', { enum: ['Active', 'Inactive'] }).notNull().default('Active'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('inv_prod_org_code_uniq').on(table.organizationId, table.itemCode),
  index('inv_prod_org_cat_idx').on(table.organizationId, table.categoryId),
]);

// =============================================
// INVENTORY STOCK (warehouse-level on-hand)
// =============================================
export const inventoryStock = pgTable('inventory_stock', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => inventoryProducts.id),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id),
  branchId: uuid('branch_id').references(() => branches.id),
  currentStock: integer('current_stock').notNull().default(0),
  reservedStock: integer('reserved_stock').notNull().default(0),
  availableStock: integer('available_stock').notNull().default(0),
  lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('inv_stock_org_prod_wh_uniq').on(table.organizationId, table.productId, table.warehouseId),
  index('inv_stock_org_prod_idx').on(table.organizationId, table.productId),
]);

// =============================================
// INVENTORY TRANSACTIONS
// =============================================
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => inventoryProducts.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  transactionType: text('transaction_type', {
    enum: ['Purchase', 'Consume', 'Adjustment', 'Transfer', 'Return']
  }).notNull(),
  quantity: integer('quantity').notNull(),
  referenceNo: text('reference_no'),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  remarks: text('remarks'),
  handledBy: text('handled_by').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('inv_txn_org_prod_idx').on(table.organizationId, table.productId),
  index('inv_txn_org_date_idx').on(table.organizationId, table.dateBs),
  index('inv_txn_org_type_idx').on(table.organizationId, table.transactionType),
]);

// =============================================
// SUPPLIERS
// =============================================
export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  pan: text('pan'),
  status: text('status', { enum: ['Active', 'Inactive'] }).notNull().default('Active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('supplier_org_code_uniq').on(table.organizationId, table.code),
  index('supplier_org_idx').on(table.organizationId),
]);

// =============================================
// PURCHASE ORDERS
// =============================================
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  poNo: text('po_no').notNull(),                      // unique per org
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  branchId: uuid('branch_id').references(() => branches.id),
  orderDateBs: text('order_date_bs').notNull(),
  expectedDeliveryBs: text('expected_delivery_bs'),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  status: text('status', {
    enum: ['Draft', 'Approved', 'Ordered', 'Partially_Received', 'Received', 'Cancelled']
  }).notNull().default('Draft'),
  approvedBy: uuid('approved_by'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('po_org_no_uniq').on(table.organizationId, table.poNo),
  index('po_org_supplier_idx').on(table.organizationId, table.supplierId),
  index('po_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// PURCHASE ITEMS (PO line items)
// =============================================
export const purchaseItems = pgTable('purchase_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => inventoryProducts.id),
  orderedQty: integer('ordered_qty').notNull(),
  receivedQty: integer('received_qty').notNull().default(0),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
  totalPrice: numeric('total_price', { precision: 15, scale: 2 }).notNull(),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('po_item_org_po_idx').on(table.organizationId, table.purchaseOrderId),
  index('po_item_org_prod_idx').on(table.organizationId, table.productId),
]);

// =============================================
// STOCK ADJUSTMENTS
// =============================================
export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => inventoryProducts.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  branchId: uuid('branch_id').references(() => branches.id),
  adjustmentType: text('adjustment_type', { enum: ['Increase', 'Decrease', 'Recount'] }).notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by'),
  dateBs: text('date_bs').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('stock_adj_org_prod_idx').on(table.organizationId, table.productId),
  index('stock_adj_org_date_idx').on(table.organizationId, table.dateBs),
]);
