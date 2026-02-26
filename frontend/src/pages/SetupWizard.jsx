import React, { useState } from 'react';
import StepDatabase from '../components/wizard/StepDatabase';
import StepLDAP from '../components/wizard/StepLDAP';
import StepAdmin from '../components/wizard/StepAdmin';

const STEPS = [
  { id: 1, label: 'Base de données GLPI', icon: '🗄️' },
  { id: 2, label: 'Connexion LDAP', icon: '🔗' },
  { id: 3, label: 'Compte administrateur', icon: '👤' },
];

export default function SetupWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const markStepDone = (step) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const goNext = () => setCurrentStep(s => Math.min(s + 1, 3));
  const goBack = () => setCurrentStep(s => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📊</div>
          <h1 className="text-3xl font-bold text-white">GLPI Dashboard</h1>
          <p className="text-blue-200 mt-1">Configuration initiale</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${completedSteps.has(step.id)
                    ? 'bg-green-400 text-white'
                    : currentStep === step.id
                    ? 'bg-white text-brand-700'
                    : 'bg-blue-700 text-blue-300'}
                `}>
                  {completedSteps.has(step.id) ? '✓' : step.id}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${
                  currentStep === step.id ? 'text-white' : 'text-blue-300'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 max-w-[60px] transition-all ${
                  completedSteps.has(step.id) ? 'bg-green-400' : 'bg-blue-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card étape courante */}
        <div className="card shadow-xl">
          {currentStep === 1 && (
            <StepDatabase
              onSuccess={() => { markStepDone(1); goNext(); }}
            />
          )}
          {currentStep === 2 && (
            <StepLDAP
              onSuccess={() => { markStepDone(2); goNext(); }}
              onSkip={() => { goNext(); }}
              onBack={goBack}
            />
          )}
          {currentStep === 3 && (
            <StepAdmin
              onSuccess={onComplete}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
