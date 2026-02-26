import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { format, subDays, startOfWeek, startOfMonth, subMonths, endOfMonth, startOfQuarter, startOfYear, subMonths as sub } from 'date-fns';
import { fr } from 'date-fns/locale';

const QUICK_PERIODS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
  { id: 'last_month', label: 'Mois précédent' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'semester', label: 'Semestre' },
];

export default function DateRangePicker({ value, onChange }) {
  // value: { period: 'month' } ou { from: Date, to: Date, period: 'custom' }
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);

  const handleQuickPeriod = (periodId) => {
    setShowCustom(false);
    onChange({ period: periodId });
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({
        period: 'custom',
        from: format(customFrom, 'yyyy-MM-dd'),
        to: format(customTo, 'yyyy-MM-dd'),
      });
      setShowCustom(false);
    }
  };

  const currentPeriod = value?.period;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Boutons périodes rapides */}
      {QUICK_PERIODS.map(p => (
        <button
          key={p.id}
          onClick={() => handleQuickPeriod(p.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            currentPeriod === p.id && currentPeriod !== 'custom'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Bouton plage personnalisée */}
      <div className="relative">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentPeriod === 'custom'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          📅 {currentPeriod === 'custom' && value.from
            ? `${value.from} → ${value.to}`
            : 'Plage personnalisée'}
        </button>

        {showCustom && (
          <div className="absolute top-10 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[320px]">
            <p className="text-sm font-medium text-gray-700 mb-3">Sélectionner une plage</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Du</label>
                <DatePicker
                  selected={customFrom}
                  onChange={setCustomFrom}
                  selectsStart
                  startDate={customFrom}
                  endDate={customTo}
                  maxDate={customTo || new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={fr}
                  placeholderText="Date début"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="label text-xs">Au</label>
                <DatePicker
                  selected={customTo}
                  onChange={setCustomTo}
                  selectsEnd
                  startDate={customFrom}
                  endDate={customTo}
                  minDate={customFrom}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={fr}
                  placeholderText="Date fin"
                  className="input text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowCustom(false)} className="btn-secondary flex-1 text-sm py-1.5">
                Annuler
              </button>
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="btn-primary flex-1 text-sm py-1.5"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
