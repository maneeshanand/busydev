import { useEffect, useRef, useState } from "react";
import type { BusyAgent, LlmProvider } from "../types";
import { agentSlug } from "../lib/busyAgents";
import { getEnabledProviders } from "../lib/providers";
import "./SessionWizard.css";

// ── Public types ──────────────────────────────────────────────────────────────

export interface WizardResult {
  description: string;
  branch: string;
  provider: string;
  autoExecute: boolean;
  steps: { text: string; notes: string; agentId: string }[];
}

// ── Internal step state ───────────────────────────────────────────────────────

interface PlanStepState {
  text: string;
  notes: string;
  agentSlug: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SessionWizardProps {
  busyAgents: BusyAgent[];
  providers: LlmProvider[];
  currentAgent: string;
  onQuickSession: () => void;
  onGeneratePlan: (description: string) => void;
  generatedSteps: { text: string; agentSlug: string }[] | null;
  generatedBranch: string | null;
  generating: boolean;
  onExecute: (result: WizardResult) => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type WizardStep = "choose" | "describe" | "review";

function slugifyDescription(description: string): string {
  return agentSlug(description.trim().slice(0, 60)) || "feature";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionWizard(props: SessionWizardProps) {
  const {
    busyAgents,
    providers,
    currentAgent,
    onQuickSession,
    onGeneratePlan,
    generatedSteps,
    generatedBranch,
    generating,
    onExecute,
    onCancel,
  } = props;

  const [step, setStep] = useState<WizardStep>("choose");
  const [description, setDescription] = useState("");

  // Review step state
  const [branch, setBranch] = useState("");
  const [planSteps, setPlanSteps] = useState<PlanStepState[]>([]);

  const enabledProviders = getEnabledProviders(providers);
  const defaultProvider =
    enabledProviders.find((p) => busyAgents.find((a) => a.id === currentAgent)?.base === p.id)?.id ??
    enabledProviders[0]?.id ??
    "";
  const [provider, setProvider] = useState(defaultProvider);
  const [autoExecute, setAutoExecute] = useState(true);

  // Track previous generatedSteps to detect transition from null to populated
  const prevGeneratedStepsRef = useRef<typeof generatedSteps>(null);

  useEffect(() => {
    const prev = prevGeneratedStepsRef.current;
    prevGeneratedStepsRef.current = generatedSteps;

    if (prev === null && generatedSteps !== null && generatedSteps.length > 0 && step === "describe") {
      // Initialize plan steps from generated data
      setPlanSteps(
        generatedSteps.map((s) => ({ text: s.text, notes: "", agentSlug: s.agentSlug }))
      );
      setBranch(generatedBranch ?? slugifyDescription(description));
      setStep("review");
    }
  }, [generatedSteps, generatedBranch, step, description]);

  // ── Step 1: Choose Mode ────────────────────────────────────────────────────

  function renderChoose() {
    return (
      <div className="wizard-choices">
        <button
          className="wizard-choice"
          onClick={onQuickSession}
          type="button"
        >
          <span className="wizard-choice-icon">⚡</span>
          <span className="wizard-choice-name">Quick Session</span>
          <span className="wizard-choice-desc">
            Jump straight into a new session with no planning.
          </span>
        </button>

        <button
          className="wizard-choice wizard-choice-primary"
          onClick={() => setStep("describe")}
          type="button"
        >
          <span className="wizard-choice-icon">🗺</span>
          <span className="wizard-choice-name">Build a Feature</span>
          <span className="wizard-choice-desc">
            Describe what you want to build and let AI generate an execution plan.
          </span>
        </button>
      </div>
    );
  }

  // ── Step 2: Describe Feature ───────────────────────────────────────────────

  function renderDescribe() {
    const canGenerate = description.trim().length > 0 && !generating;

    return (
      <div className="wizard-describe">
        <textarea
          className="wizard-textarea"
          rows={6}
          placeholder="Describe the feature you want to build…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={generating}
        />
        <p className="wizard-hint">
          Tip: paste a ticket URL if your agent has Jira/Linear MCP access
        </p>
        <div className="wizard-actions">
          <button
            className="wizard-btn"
            onClick={() => setStep("choose")}
            type="button"
            disabled={generating}
          >
            ← Back
          </button>
          <button
            className="wizard-btn wizard-btn-primary"
            onClick={() => onGeneratePlan(description)}
            disabled={!canGenerate}
            type="button"
          >
            {generating ? "Generating…" : "Generate Plan →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Review Plan ────────────────────────────────────────────────────

  function updateStep(index: number, patch: Partial<PlanStepState>) {
    setPlanSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function removeStep(index: number) {
    setPlanSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setPlanSteps((prev) => [
      ...prev,
      {
        text: "New step",
        notes: "",
        agentSlug: busyAgents.length > 0 ? agentSlug(busyAgents[0].name) : "agent",
      },
    ]);
  }

  function handleApprove() {
    // Map agentSlug back to agentId
    const steps = planSteps.map((s) => {
      const agent = busyAgents.find((a) => agentSlug(a.name) === s.agentSlug);
      return {
        text: s.text,
        notes: s.notes,
        agentId: agent?.id ?? s.agentSlug,
      };
    });

    onExecute({
      description,
      branch,
      provider,
      autoExecute,
      steps,
    });
  }

  function handleBack() {
    setPlanSteps([]);
    setStep("describe");
  }

  function handleRegenerate() {
    setPlanSteps([]);
    prevGeneratedStepsRef.current = null;
    setStep("describe");
    onGeneratePlan(description);
  }

  function renderReview() {
    return (
      <div className="wizard-review">
        {/* Config bar */}
        <div className="wizard-config">
          <label className="wizard-config-field">
            <span className="wizard-config-label">Branch</span>
            <input
              className="wizard-config-input"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </label>

          <label className="wizard-config-field">
            <span className="wizard-config-label">LLM Provider</span>
            <select
              className="wizard-config-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {enabledProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="wizard-config-check">
            <input
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
            />
            <span>Auto-execute</span>
          </label>
        </div>

        {/* Plan steps */}
        <div className="wizard-steps">
          {planSteps.map((s, i) => (
            <details key={i} className="wizard-step">
              <summary className="wizard-step-summary">
                <span className="wizard-step-number">{i + 1}</span>
                <span className="wizard-step-title">{s.text}</span>
                <span className="wizard-step-agent">{s.agentSlug}</span>
                <span className="wizard-step-chevron" aria-hidden="true">›</span>
              </summary>
              <div className="wizard-step-detail">
                <label className="wizard-step-field">
                  <span className="wizard-step-field-label">Title</span>
                  <input
                    className="wizard-step-input"
                    type="text"
                    value={s.text}
                    onChange={(e) => updateStep(i, { text: e.target.value })}
                  />
                </label>
                <label className="wizard-step-field">
                  <span className="wizard-step-field-label">Notes</span>
                  <textarea
                    className="wizard-step-notes"
                    rows={3}
                    value={s.notes}
                    onChange={(e) => updateStep(i, { notes: e.target.value })}
                    placeholder="Optional notes or context…"
                  />
                </label>
                <label className="wizard-step-field">
                  <span className="wizard-step-field-label">Agent</span>
                  <select
                    className="wizard-config-select"
                    value={s.agentSlug}
                    onChange={(e) => updateStep(i, { agentSlug: e.target.value })}
                  >
                    {busyAgents.map((a) => (
                      <option key={a.id} value={agentSlug(a.name)}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="wizard-btn wizard-btn-danger"
                  onClick={() => removeStep(i)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </details>
          ))}
        </div>

        <button className="wizard-add-step" onClick={addStep} type="button">
          + Add Step
        </button>

        {/* Footer actions */}
        <div className="wizard-actions">
          <button
            className="wizard-btn"
            onClick={handleBack}
            type="button"
          >
            ← Back
          </button>
          <button
            className="wizard-btn"
            onClick={handleRegenerate}
            type="button"
            disabled={generating}
          >
            {generating ? "Generating…" : "Regenerate"}
          </button>
          <button
            className="wizard-btn wizard-btn-approve"
            onClick={handleApprove}
            type="button"
            disabled={planSteps.length === 0}
          >
            Approve &amp; Execute →
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const stepLabels: Record<WizardStep, string> = {
    choose: "New Session",
    describe: "Describe Feature",
    review: "Review Plan",
  };

  return (
    <div className="wizard">
      <div className="wizard-header">
        <span className="wizard-title">{stepLabels[step]}</span>
        <button className="wizard-btn wizard-btn-ghost wizard-close" onClick={onCancel} type="button" aria-label="Cancel">
          ✕
        </button>
      </div>

      <div className="wizard-body">
        {step === "choose" && renderChoose()}
        {step === "describe" && renderDescribe()}
        {step === "review" && renderReview()}
      </div>
    </div>
  );
}
