import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PIPELINE_STAGES, STAGE_DEFINITIONS, type PipelineStage } from '../config.ts';

describe('Pipeline Stages Configuration', () => {
  it('contains exactly the 15 verified operational recruitment stages', () => {
    assert.strictEqual(PIPELINE_STAGES.length, 15);

    const expectedStages: PipelineStage[] = [
      'Unassigned',
      'Assigned – Not Called',
      'Callback',
      'Not Reachable',
      'Interested',
      'Interview Scheduled',
      'Interview Attended',
      'Interview No Show',
      'Not Interested / Closed',
      'Selected – Joining Pending',
      'Joined',
      'On Hold',
      'Rejected',
      'Dropped / Not Joined',
      'DUPLICATE HOLD'
    ];

    expectedStages.forEach((stage) => {
      assert.ok(
        PIPELINE_STAGES.includes(stage),
        `Pipeline stages must include '${stage}'`
      );
    });
  });

  it('defines valid badge classes, labels, and categories for every stage', () => {
    PIPELINE_STAGES.forEach((stage) => {
      const def = STAGE_DEFINITIONS[stage];
      assert.ok(def, `Stage definition missing for '${stage}'`);
      assert.strictEqual(def.id, stage);
      assert.ok(typeof def.label === 'string' && def.label.length > 0);
      assert.ok(typeof def.badgeClass === 'string' && def.badgeClass.length > 0);
      assert.ok(
        ['sourcing', 'contact', 'drop', 'interview', 'offer', 'joined', 'hold'].includes(def.category),
        `Category '${def.category}' for stage '${stage}' must be valid`
      );
    });
  });
});
