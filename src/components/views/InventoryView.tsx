import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { ShoppingBag, PackageCheck, Plus, PackagePlus } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { FormLabelWithHelp } from '../common/FormHelpTooltip';

interface InventoryItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'Fertilizer' | 'Seeds' | 'Consumer Goods' | 'Dairy Tools';
  unit: 'Bag' | 'Kg' | 'Litre' | 'Pcs';
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  reorderLevel: number;
}

export const InventoryView: React.FC = () => {
  const { addNotification } = useCoop();

  const [items, setItems] = useState<InventoryItem[]>([
    { id: 'inv-1', itemCode: 'INV-FERT-01', itemName: 'Urea Fertilizer 50kg Bag', category: 'Fertilizer', unit: 'Bag', costPrice: 950, sellingPrice: 1050, stockQuantity: 420, reorderLevel: 50 },
    { id: 'inv-2', itemCode: 'INV-SEED-02', itemName: 'Hybrid Paddy Seeds Khumal-4 (10kg)', category: 'Seeds', unit: 'Kg', costPrice: 450, sellingPrice: 520, stockQuantity: 280, reorderLevel: 30 },
    { id: 'inv-3', itemCode: 'INV-GOODS-03', itemName: 'Mustard Oil Pure Tokla (1 Litre)', category: 'Consumer Goods', unit: 'Litre', costPrice: 220, sellingPrice: 250, stockQuantity: 600, reorderLevel: 100 },
    { id: 'inv-4', itemCode: 'INV-TOOL-04', itemName: 'Stainless Steel Milk Can 20L', category: 'Dairy Tools', unit: 'Pcs', costPrice: 3800, sellingPrice: 4200, stockQuantity: 45, reorderLevel: 10 },
  ]);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<'Fertilizer' | 'Seeds' | 'Consumer Goods' | 'Dairy Tools'>('Fertilizer');
  const [unit, setUnit] = useState<'Bag' | 'Kg' | 'Litre' | 'Pcs'>('Bag');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [initialQty, setInitialQty] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) return;

    const newItem = {
      id: `inv-${Date.now()}`,
      itemCode: `INV-${category.substring(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      itemName,
      category,
      unit,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stockQuantity: parseInt(initialQty, 10) || 0,
      reorderLevel: 20,
    };

    setItems([newItem, ...items]);
    addNotification('Inventory Item Added', `${itemName} successfully registered in store stock master.`, 'success');
    setItemName('');
    setCostPrice('');
    setSellingPrice('');
    setInitialQty('');
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Multipurpose Cooperative Consumer Store Inventory</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
            <span>Retail store goods master, fertilizer stock, purchase entry, and member sales</span>
          </p>
        </div>
      </div>

      {/* Add Inventory Item Form */}
      <ExpandableFormCard
        title="Register New Inventory Store Stock Item"
        subtitle="Add retail store goods, fertilizer bags, seeds, or consumer items to store catalog"
        icon={<PackagePlus className="w-5 h-5 text-emerald-700" />}
        onSubmit={handleAddItem}
        footerActions={
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item to Store Inventory</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <FormLabelWithHelp
              label="Item Full Name"
              required
              helpTitle="Stock Item Name"
              helpText="Enter the trade name or brand specification of the product."
              example="Urea Fertilizer 50kg Bag"
            />
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Pure Mustard Oil 1L"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            />
          </div>

          <div>
            <FormLabelWithHelp
              label="Store Category"
              required
              helpTitle="Product Classification"
              helpText="Select whether item belongs to agricultural inputs, seeds, or general consumer goods."
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            >
              <option value="Fertilizer">Fertilizer (मल)</option>
              <option value="Seeds">Seeds (बीउ/बिजन)</option>
              <option value="Consumer Goods">Consumer Goods (खाद्यान्न)</option>
              <option value="Dairy Tools">Dairy Tools (दुग्ध सामग्री)</option>
            </select>
          </div>

          <div>
            <FormLabelWithHelp
              label="Measurement Unit"
              required
              helpTitle="Stock Unit"
              helpText="Standard quantity measurement unit used for stock sales and billing."
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            >
              <option value="Bag">Bag (बोरा)</option>
              <option value="Kg">Kg (कि.ग्रा.)</option>
              <option value="Litre">Litre (लिटर)</option>
              <option value="Pcs">Pcs (थान)</option>
            </select>
          </div>

          <div>
            <FormLabelWithHelp
              label="Cost Price / Purchase Rate (NPR)"
              required
              helpTitle="Acquisition Cost"
              helpText="Supplier purchase cost per unit."
              example="950"
            />
            <input
              type="number"
              required
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            />
          </div>

          <div>
            <FormLabelWithHelp
              label="Member Selling Price (NPR)"
              required
              helpTitle="Retail Price"
              helpText="Sales rate charged to cooperative members."
              example="1050"
            />
            <input
              type="number"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            />
          </div>

          <div>
            <FormLabelWithHelp
              label="Initial Stock Quantity"
              required
              helpTitle="Opening Quantity"
              helpText="Stock units currently present in store warehouse."
              example="100"
            />
            <input
              type="number"
              required
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs font-bold"
            />
          </div>
        </div>
      </ExpandableFormCard>

      {/* Inventory Items Grid */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Consumer Store Goods & Fertilizer Stock Master</h2>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">Item Code & Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">In Stock Qty</th>
                <th className="p-3 text-right">Cost Price (रु.)</th>
                <th className="p-3 text-right">Selling Price (रु.)</th>
                <th className="p-3 text-right">Total Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="p-3 font-bold text-slate-900">
                    <span className="font-mono text-amber-700 mr-2">{item.itemCode}</span>
                    <span>{item.itemName}</span>
                  </td>
                  <td className="p-3 text-slate-500">{item.category}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-800">{item.stockQuantity} {item.unit}</td>
                  <td className="p-3 text-right font-mono text-slate-600">{formatNPR(item.costPrice)}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(item.sellingPrice)}</td>
                  <td className="p-3 text-right font-mono font-bold text-amber-800">{formatNPR(item.stockQuantity * item.costPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
