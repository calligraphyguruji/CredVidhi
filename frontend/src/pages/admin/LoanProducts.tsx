import React from 'react';
import { FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/financial';

export const LoanProducts: React.FC = () => {
  const { products } = useApp();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-md border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-mono uppercase text-blue-700 font-semibold tracking-wider">
            Enterprise Product Catalog
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            Configured Loan Products & Underwriting Guidelines
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Institutional policy limits, base interest rates, mandatory documentation checklists, and DTI caps.
          </p>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {products.map((product) => (
          <Card
            key={product.id}
            title={product.name}
            subtitle={`Code: ${product.code}`}
            headerAction={
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded">
                ACTIVE
              </span>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 text-xs min-h-[36px]">{product.description}</p>

              {/* Policy Parameters */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Base Fixed APR:</span>
                  <span className="font-mono font-bold text-blue-700">{product.baseApr}%</span>
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
                  Mandatory Document Checklist
                </span>
                <div className="space-y-1.5">
                  {product.requiredDocuments.map((doc, i) => (
                    <div
                      key={i}
                      className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center gap-2 text-[11px]"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{doc.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
