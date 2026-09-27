import React, { useState } from 'react';
import { FileText, Plus, Edit3, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/financial';
import type { LoanProduct, DocumentChecklistItem } from '../../types';

export const LoanProducts: React.FC = () => {
  const { products, addLoanProduct, updateLoanProduct } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minAmount, setMinAmount] = useState(10000);
  const [maxAmount, setMaxAmount] = useState(100000);
  const [minTenorMonths, setMinTenorMonths] = useState(12);
  const [maxTenorMonths, setMaxTenorMonths] = useState(60);
  const [baseApr, setBaseApr] = useState(9.5);
  const [maxDtiRatio, setMaxDtiRatio] = useState(45);
  const [isActive, setIsActive] = useState(true);
  const [requiredDocs, setRequiredDocs] = useState<DocumentChecklistItem[]>([
    { code: 'GOV_ID', title: 'Government Photo ID', description: 'Passport or Driver License', mandatory: true },
    { code: 'INCOME_PROOF', title: 'Income Proof / Payslips', description: 'Recent proof of regular income', mandatory: true },
  ]);
  const [newDocTitle, setNewDocTitle] = useState('');

  const openCreateModal = () => {
    setEditingProductId(null);
    setCode('');
    setName('');
    setDescription('');
    setMinAmount(10000);
    setMaxAmount(100000);
    setMinTenorMonths(12);
    setMaxTenorMonths(60);
    setBaseApr(9.5);
    setMaxDtiRatio(45);
    setIsActive(true);
    setRequiredDocs([
      { code: 'GOV_ID', title: 'Government Photo ID', description: 'Passport or Driver License', mandatory: true },
      { code: 'INCOME_PROOF', title: 'Income Proof / Payslips', description: 'Recent proof of regular income', mandatory: true },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (product: LoanProduct) => {
    setEditingProductId(product.id);
    setCode(product.code);
    setName(product.name);
    setDescription(product.description);
    setMinAmount(product.minAmount);
    setMaxAmount(product.maxAmount);
    setMinTenorMonths(product.minTenorMonths);
    setMaxTenorMonths(product.maxTenorMonths);
    setBaseApr(product.baseApr);
    setMaxDtiRatio(product.maxDtiRatio);
    setIsActive(product.isActive);
    setRequiredDocs([...product.requiredDocuments]);
    setIsModalOpen(true);
  };

  const handleAddDoc = () => {
    if (!newDocTitle.trim()) return;
    const docCode = newDocTitle.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    setRequiredDocs((prev) => [
      ...prev,
      { code: docCode, title: newDocTitle.trim(), description: 'Required documentation verification', mandatory: true },
    ]);
    setNewDocTitle('');
  };

  const handleRemoveDoc = (index: number) => {
    setRequiredDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!code.trim() || !name.trim()) return;

    if (editingProductId) {
      updateLoanProduct(editingProductId, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        minTenorMonths: Number(minTenorMonths),
        maxTenorMonths: Number(maxTenorMonths),
        baseApr: Number(baseApr),
        maxDtiRatio: Number(maxDtiRatio),
        isActive,
        requiredDocuments: requiredDocs,
      });
    } else {
      addLoanProduct({
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        minTenorMonths: Number(minTenorMonths),
        maxTenorMonths: Number(maxTenorMonths),
        baseApr: Number(baseApr),
        maxDtiRatio: Number(maxDtiRatio),
        isActive,
        requiredDocuments: requiredDocs,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-md border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-mono uppercase text-orange-600 font-semibold tracking-wider">
            Enterprise Product Catalog & Policy Engine
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            Configured Loan Products & Underwriting Guidelines
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Institutional policy limits, base interest rates, mandatory documentation checklists, and hard DTI caps.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={openCreateModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Configure New Product
        </Button>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {products.map((product) => (
          <Card
            key={product.id}
            title={product.name}
            subtitle={`Code: ${product.code}`}
            headerAction={
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    product.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  }`}
                >
                  {product.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <button
                  type="button"
                  onClick={() => openEditModal(product)}
                  className="p-1 text-slate-400 hover:text-orange-600 rounded transition-colors cursor-pointer"
                  title="Edit product parameters"
                  aria-label={`Edit ${product.name}`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 text-xs min-h-[36px]">{product.description}</p>

              {/* Policy Parameters */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Base Fixed APR:</span>
                  <span className="font-mono font-bold text-orange-600">{product.baseApr}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Allowable Amount:</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {formatCurrency(product.minAmount)} – {formatCurrency(product.maxAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Tenor Range:</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {product.minTenorMonths} – {product.maxTenorMonths} Mos
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Hard DTI Cap:</span>
                  <span className="font-mono font-bold text-amber-700">
                    &le; {product.maxDtiRatio}%
                  </span>
                </div>
              </div>

              {/* Mandatory Checklist Items */}
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block mb-2">
                  Mandatory Document Checklist ({product.requiredDocuments.length})
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {product.requiredDocuments.map((doc, i) => (
                    <div
                      key={i}
                      className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{doc.title}</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0 uppercase">REQUIRED</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(product)}
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Edit Policy Bounds
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Product Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="lg"
        title={editingProductId ? 'Edit Loan Product Policy' : 'Configure New Loan Product'}
        description="Institutional risk underwriting policy parameters, currency bounds, interest rates, and required KYC dockets."
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              {editingProductId ? 'Save Product Changes' : 'Create Loan Product'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Product Identifier Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. COMM-EQUIP"
              required
            />
            <Input
              label="Product Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Commercial Equipment Loan"
              required
            />
          </div>

          <Input
            label="Product Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Institutional lending guidelines and borrower eligibility overview"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Min Amount (₹)
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Max Amount (₹)
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Min Tenor (Mo)
              </label>
              <input
                type="number"
                value={minTenorMonths}
                onChange={(e) => setMinTenorMonths(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Max Tenor (Mo)
              </label>
              <input
                type="number"
                value={maxTenorMonths}
                onChange={(e) => setMaxTenorMonths(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Base Fixed APR (%)
              </label>
              <input
                type="number"
                step="0.05"
                value={baseApr}
                onChange={(e) => setBaseApr(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Hard DTI Cap (%)
              </label>
              <input
                type="number"
                step="1"
                value={maxDtiRatio}
                onChange={(e) => setMaxDtiRatio(Number(e.target.value))}
                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Product Lifecycle Status
              </label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full text-xs p-1.5 rounded border font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {isActive ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active in Catalog
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" /> Inactive / Retired
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Document Checklist Items */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Mandatory Document Requirements
            </label>
            <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
              {requiredDocs.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-orange-600" />
                    <span className="font-medium text-slate-800">{doc.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(idx)}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add checklist item (e.g. Bank Statements, Tax Returns)..."
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDoc();
                  }
                }}
                className="flex-1 text-xs p-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white"
              />
              <Button variant="outline" size="sm" onClick={handleAddDoc}>
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
