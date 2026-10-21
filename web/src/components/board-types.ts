import type { MoveView, StateView } from "@/lib/engine-types";
import type { ThemeId } from "@/lib/themes";

export interface BoardProps {
  state: StateView;
  /** Selected piece name (on the board or the next piece from a hand). */
  selected: string | null;
  /** Legal destinations for the selected piece (green). */
  targets: MoveView[];
  /** Where the selected piece could go on its owner's next turn (coral, dashed). */
  previewTargets?: MoveView[];
  hint?: MoveView | null;
  onPieceClick?: (name: string) => void;
  onTargetClick?: (m: MoveView) => void;
  onBackgroundClick?: () => void;
  theme: ThemeId;
  /** Pieces on the board that currently have legal moves. */
  selectable: Set<string>;
  /** Hide the last-move highlight (e.g. for demos). */
  hideLastMove?: boolean;
}
