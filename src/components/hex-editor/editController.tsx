import { HexEditor } from './hex-editor';
import { forceUpdate } from '@stencil/core';

type editType = "insert" | "overwrite";
// type piece = {offset: number, length: number, source: "origin", editNum: 0};
// type addedPiece = {offset: number, type: editType, length: number, source: "added", editNum: number};
// type inprogress = {offset: number, type: editType, length: number, source: "inprogress", index: number, content: number[], editNum: number};
type anyPiece = Original | Added | InProgress;
type existingPiece = Existing;

function isInprogress(piece: anyPiece): piece is InProgress {
  if (piece instanceof InProgress) return true;
  else return false;
}

function last<T>(arr: T[]) {
  if (arr.length > 0) return arr[arr.length - 1];
  return undefined;
}

abstract class Existing {
  public editNum: number;
  public self: Existing | Existing[];

  constructor(
    public offset: number,
    public length: number,
    public modified: number = 0,
    private myType: typeof Original | typeof Added
  ) {
    this.self = this;
  }

  abstract makeNew(offset: number, length: number, modified?: number): Existing

  splitAt(position: number) {
    const left = this.makeNew(this.mOffset, position);
    const right = this.makeNew(this.offset + position, this.length - position, this.modified)
    if (left.length === 0) {
      this.self = [right];
      return [undefined, right];
    }
    if (right.mLength === 0) {
      this.self = [left];
      return [left, undefined];
    }
    return (this.self = [ left, right ])
  }

  isContinuedBy(other: this): other is this {
    if (other instanceof this.myType) {
      return this.mLength + this.mOffset === other.mOffset && this.editNum === other.editNum
    }
    return false;
  }

  join(other: this) {
    return (this.self = this.makeNew(this.mOffset, this.mLength + other.mLength));
  }

  get isSelf() { return this === this.self }
  get mOffset() { return this.offset + this.modified }
  get mLength() { return this.length - this.modified }
  get pieces() {
    if (Array.isArray(this.self)) {
      if (this.self.length === 1) return [...this.self[0].pieces]
      return [...this.self[0].pieces, ...this.self[1].pieces]
    }
    return [this.self];
  }
}

class Original extends Existing {
  constructor(
    offset: number,
    length: number,
    modified: number = 0
  ) {
    super(offset, length, modified, Original);
  }

  makeNew(offset: number, length: number, modified?: number): Original {
    return new Original(offset, length, modified);
  }
}

class Added extends Existing {
  public self: Added | Added[];

  constructor(
    offset: number,
    length: number,
    public type: editType,
    public editNum: number,
    public consumption: {startMod: number, consumed: boolean, piece: existingPiece}[] = [],
    modified: number = 0
  ){
    super(offset, length, modified, Added);
  }

  makeNew(offset: number, length: number, modified?: number): Added {
    return new Added(offset, length, this.type, this.editNum, this.consumption, modified);
  }
}

class InProgress {
  public content: number[] = []
  public consumption: {startMod: number, consumed: boolean, piece: existingPiece}[] = [];

  constructor(
    public offset: number,
    public type: editType,
    public editNum: number,
    public index: number,
  ) {}

  get length() { return this.content.length }
  get modified() { return 0 }
  get mLength() { return this.length }
  get mOffset() { return this.offset }
  get pieces() { return [this] }
}

/**
 * controls the editing of values in the hex editor
 */
export class EditController {
  original: Uint8Array;
  added: Uint8Array = new Uint8Array();
  pieces: Array<anyPiece> = [];
  undoStack: Array<anyPiece> = [];
  redoStack: Array<[Existing, number, anyPiece]> = [];
  inProgress: InProgress;
  chunk: string = '';

  constructor(
    private parent: HexEditor
  ) {
    this.original = parent.file;
    this.pieces = [new Original(0, this.original.length)]
    window['rollback'] = () => {
      this.rollback();
      console.log(this.pieces);
    }
    window['ec'] = this;
  }

  initEdit(offset: number, type: editType) {
    if (this.redoStack.length > 0) this.rollback();
    this.inProgress = new InProgress(this.added.length, type, this.undoStack.length + 1, -1)

    let {targetIndex, targetSlicePoint, target} = this.getPieceAtOffset(offset)
    if (target instanceof Existing) {
      const splitParts = target.splitAt(targetSlicePoint);
      let toInsert;
      if (!splitParts[0]) {
        this.inProgress.index = targetIndex;
        toInsert = [this.inProgress, splitParts[1]]
      } else if (!splitParts[1]) {
        this.inProgress.index = targetIndex + 1;
        toInsert = [splitParts[0], this.inProgress]
      } else {
        this.inProgress.index = targetIndex + 1;
        toInsert = [
          splitParts[0],
          this.inProgress,
          splitParts[1]
        ];
      }


      this.pieces.splice(targetIndex, 1, ...toInsert);
    }

    this.undoStack.push(this.inProgress);
  }

  /**
   * gets the piece at an offset
   * @param offset
   */
  getPieceAtOffset(offset: number): {targetSlicePoint: number, targetIndex: number, target: existingPiece} {
    let tracker = 0;
    let targetSlicePoint: number;
    let targetIndex: number;
    let target: existingPiece;
    for (const [i, piece] of (this.pieces as existingPiece[]).entries()) {
      tracker += piece.mLength;
      if (tracker >= offset) {
        targetSlicePoint = piece.mLength - tracker + offset;
        targetIndex = i;
        target = piece;
        break;
      }
    }
    return {
      targetSlicePoint,
      targetIndex,
      target
    }
  }

  get isInProgress() { return !!this.inProgress }

  /**
   * targets the piece next to the inProgress piece, if it exists, and
   * modifies its length/offset by amount if the inProgress type is
   * set to 'overwrite'.
   *
   * @param amount - the amount to modify the target piece's length by
   */
  modifyNextPiece(amount: number, index: number, piece?: Added) {
    const target = piece ? piece : this.inProgress;
    if (index !== this.pieces.length - 1) {
      let lastConsumption = last(target.consumption);
      if (lastConsumption === undefined || lastConsumption.consumed) {
        const nextPiece = (this.pieces as existingPiece[])[index + 1];
        lastConsumption = {
          consumed: false,
          piece: nextPiece,
          startMod: nextPiece.modified
        };
        target.consumption.push(lastConsumption)
      }

      lastConsumption.piece.modified -= amount;
      if (lastConsumption.piece.mLength === 0) {
        lastConsumption.consumed = true;

        this.pieces.splice(index + 1, 1);
      }
    }
  }

  find(searchArr: number[], from: number, maxLength?: number) {
    // Boyer-Moore string search algorighm:
    // https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_string-search_algorithm

    const results = [];

    let myChunk = this.render(from, maxLength ? maxLength : this.length - from).out;
    let inf = 0;
    for (let i = searchArr.length; i < myChunk.length; i++) {
      if (myChunk[i] === searchArr[searchArr.length - 1]) {
        for (let j = searchArr.length - 1; j >= 0; j--) {
          if (j === 0) {
            results.push(i + from - searchArr.length + 1);
            break;
          }
          if (myChunk[i - (searchArr.length - j)] !== searchArr[j - 1]) {
            i += (j - 1);
            break;
          }
        }
      } else {
        const searchIdx = searchArr.lastIndexOf(myChunk[i]);

        if (searchIdx === -1) i += searchArr.length - 1;
        else {
          i += searchArr.length - searchIdx - 2;
        }
      }
      // JUUUST to be sure there's no infinite loop
      inf++
      if (inf > 10000) break;
    }


    return results;
  }

  redo() {
    if (this.redoStack.length > 0) {
      const [neighbor, startMod, toAdd] = this.redoStack.pop() as [Existing, number, Added];
      const idx = this.pieces.indexOf(neighbor);
      // console.log(idx);

      if (toAdd.type === 'insert') {
        this.pieces.splice(idx, 0, ...toAdd.pieces);
      } else {
        let partialConsume = 0;
        let lp = last(toAdd.consumption);
        if (!lp.consumed) partialConsume = 1;
        if (!isNaN(startMod)) {
          if (!lp.piece.isSelf) {
            lp.piece.pieces[0].modified = startMod;
          } else {
            lp.piece.modified = startMod;
          }
        }
        this.pieces.splice(idx, toAdd.consumption.length - partialConsume, ...toAdd.pieces);
      }

      this.undoStack.push(toAdd);
      forceUpdate(this.parent);

    }
  }

  undo() {
    if (this.isInProgress) {
      this.commit();
      this.chunk = '';
    }
    if (this.undoStack.length > 0) {

      // get the latest undo
      const target = this.undoStack.pop();

      // get the first piece of that undo step
      const targetIdx = this.pieces.indexOf(target.pieces[0]);
      let neighbor;
      let lastMod = NaN;

      // determine type of operation
      if (target instanceof Added && target.type === 'overwrite') {
        // if type was overwrite, then there are more steps necessary
        // due to the potential to consume other pieces,
        // all of which will need to be restored


        // restore all pieces that have been FULLY consumed
        // store those that have only been partially consumed
        const restored = [];
        const partiallyConsumed: (typeof Added.prototype.consumption) = []
        for (const t of target.consumption) {
          if (t.consumed) {
            t.piece.modified = t.startMod
            restored.push(t.piece)
          } else {
            partiallyConsumed.push(t);
          }
        }

        // put restored pieces back while removing target
        this.pieces.splice(targetIdx, target.pieces.length, ...restored)

        // store the neighbor
        neighbor = this.pieces[targetIdx];

        // due to not "rolling back" every undo, the stored piece might actually be multiple
        // pieces. This is kept track of with the piece's 'self' variable.
        if (partiallyConsumed.length) {
          // store the modified value of the partially consumed piece for redo
          if (!partiallyConsumed[0].piece.isSelf) {
            const pieces = partiallyConsumed[0].piece.pieces;

            // we only need to modify the first one because the others should have been
            // taken care of by other undo operations (in theory)
            lastMod = pieces[0].modified;
            pieces[0].modified = partiallyConsumed[0].startMod - partiallyConsumed[0].piece.modified;
          } else {
            lastMod = partiallyConsumed[0].piece.modified;
            partiallyConsumed[0].piece.modified = partiallyConsumed[0].startMod;
          }
        }

      } else {
        // if the type was insert then the piece can simply be extracted without issue
        this.pieces.splice(targetIdx, target.pieces.length);
        // store the neighbor
        neighbor = this.pieces[targetIdx];
      }


      this.redoStack.push([neighbor as Existing, lastMod, target]);
      forceUpdate(this.parent);
    }

  }

  backSpace() {
    if (!this.inProgress || this.inProgress.content.length === 0) return;
    this.chunk = '';
    this.inProgress.content.pop();
    this.parent.setCursorPosition(this.parent.cursor - 1);
    this.modifyNextPiece(1, this.inProgress.index)
  }

  buildEdit(keyStroke: KeyboardEvent) {
    if (!this.parent.cursor || this.parent.cursor === -1) return;
    if (keyStroke.key === 'Z' && (keyStroke.metaKey || keyStroke.ctrlKey)) {
      this.redo()
      return;
    }
     if (keyStroke.key === 'z' && (keyStroke.metaKey || keyStroke.ctrlKey)) {
      this.undo()
      return;
    }
    else if (keyStroke.key === 'Backspace') {
      this.backSpace()
      return;
    }
    else if (this.parent.asciiMode && keyStroke.key.length === 1 && /[\u0000-\u00FF]/.test(keyStroke.key)) {
      if (!this.isInProgress)
        this.initEdit(this.parent.cursor, this.parent.editType as editType)
      this.inProgress.content.push(keyStroke.key.charCodeAt(0));
    }
    else if (/^[a-fA-F0-9]$/.test(keyStroke.key)) {
      if (!this.isInProgress)
        this.initEdit(this.parent.cursor, this.parent.editType as editType)
      this.chunk += keyStroke.key;
      if (this.chunk.length === 2) {
        this.inProgress.content.push(parseInt(this.chunk, 16));
        this.chunk = '';
      } else {
        return;
      }
    } else return;
    this.parent.setCursorPosition(this.parent.cursor + 1);

    if (this.inProgress.type === 'overwrite') this.modifyNextPiece(-1, this.inProgress.index);
  }

  commit() {
    const newArr = new Uint8Array(this.added.length + this.inProgress.content.length);
    newArr.set(this.added, 0);
    newArr.set(this.inProgress.content, this.added.length);

    const newAddedPiece = new Added(
      newArr.length - this.inProgress.length,
      this.inProgress.length,
      this.inProgress.type,
      this.inProgress.editNum,
      this.inProgress.consumption
    );
    this.pieces[this.inProgress.index] = newAddedPiece;

    this.undoStack[this.undoStack.length - 1] = newAddedPiece;
    this.added = newArr;
    this.inProgress = null;
    this.chunk = '';
  }

  rollback() {
    let chopLength = 0;
    while(this.redoStack.length > 0) {
      chopLength += this.redoStack.pop()[2].length
    }

    let newArr = new Uint8Array(this.added.length - chopLength);
    newArr.set(this.added.subarray(0, newArr.length), 0);
    this.added = newArr;

    for (let i = 0; i < this.pieces.length - 1; i++) {
      const p1 = this.pieces[i] as existingPiece;
      const p2 = this.pieces[i + 1] as existingPiece;
      if (p1.isContinuedBy(p2)) {
        this.pieces.splice(i, 2, p1.join(p2 as any));
        i--;
      }
    }
  }

  render(start: number, length: number) {
    let out = new Uint8Array(length);
    let meta: {added: [number, number][]} = {added: []}

    let tracker = 0;
    let startPlace: number;
    let startIndex: number = 0;
    for (const [i, piece] of this.pieces.entries()) {
      tracker += piece.mLength;
      if (tracker >= start) {
        startPlace = piece.mLength - tracker + start;
        startIndex = i;
        break;
      }
    }

    if (isInprogress(this.pieces[startIndex]) || this.pieces[startIndex] instanceof Added) {
      meta.added.push([start - startPlace, start - startPlace + this.pieces[startIndex].length]);
    }

    let firstChunk = this.getPieceBuffer(this.pieces[startIndex]).subarray(startPlace, startPlace + length);
    tracker = firstChunk.length;
    out.set(firstChunk, 0);
    for (let i = startIndex + 1; i < this.pieces.length; i++) {
      let piece = this.pieces[i];
      tracker += piece.mLength;
      if (isInprogress(piece) || piece instanceof Added) {
        meta.added.push([start + tracker - piece.mLength, start + tracker]);
      }
      if (tracker >= length) {
        out.set(this.getPieceBuffer(piece).subarray(0, piece.mLength - tracker + length), tracker - piece.mLength);
        break;
      }
      out.set(this.getPieceBuffer(piece), tracker - piece.mLength);
    }

    if (tracker !== length) {
      return {
        out: out.subarray(0, tracker),
        meta
      }
    }
    return {
      out,
      meta
    };
  }

  get length() {
    let lengthCheck = 0;
    for (const piece of this.pieces) {
      lengthCheck += piece.length;
    }
    return lengthCheck;
  }

  save() {
    return this.render(0, this.length).out;
  }

  private getPieceBuffer(piece: anyPiece) {
    if (isInprogress(piece)) {
      return new Uint8Array(piece.content);
    }
    // implied else
    if (piece instanceof Original) {
      return this.original.subarray(piece.mOffset, piece.mOffset+piece.mLength);
    } else {
      return this.added.subarray(piece.mOffset, piece.mOffset+piece.mLength);
    }

  }
}
