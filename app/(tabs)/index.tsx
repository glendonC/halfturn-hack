import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

// Domain types + cue catalog live in src/types and src/constants — wired in the audio-engine pass.

export default function TrainScreen() {
  return (
    <ScreenPlaceholder
      title="Train"
      purpose="Start a solo scanning drill — randomized spatial cues in your headphones so you can practice checking and reacting without a coach."
    />
  );
}
