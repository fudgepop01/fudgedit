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
    return (this.self = [
      this.makeNew(this.mOffset, position),
      this.makeNew(this.offset + position, this.length - position, this.modified)
    ]);
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
  undoStack: Array<anyPiece[]> = [];
  redoStack: Array<anyPiece[]> = [];
  inProgress: InProgress;
  chunk: string = '';

  constructor(
    private parent: HexEditor
  ) {
    this.original = parent.file;
    this.pieces = [new Original(0, this.original.length)]
  }

  initEdit(offset: number, type: editType) {
    if (this.redoStack.length > 0) this.rollback();
    this.inProgress = new InProgress(this.added.length, type, this.undoStack.length + 1, -1)

    let {targetIndex, targetSlicePoint, target} = this.getPieceAtOffset(offset)
    if (target instanceof Added) {
      const splitParts = target.splitAt(targetSlicePoint);
      this.inProgress.index = targetIndex + 1;
      const toInsert = [
        splitParts[0],
        this.inProgress,
        splitParts[1]
      ];

      // const toUpdate = this.undoStack[target.editNum - 1];
      // toUpdate.splice(toUpdate.indexOf(target), 1, ...splitParts)

      this.pieces.splice(targetIndex, 1, ...toInsert);
    } else if (target instanceof Original) {
      const splitParts = target.splitAt(targetSlicePoint);
      console.log(splitParts);
      this.inProgress.index = targetIndex + 1;
      const toInsert = [
        splitParts[0],
        this.inProgress,
        splitParts[1]
      ];

      this.pieces.splice(targetIndex, 1, ...toInsert);
    }

    this.undoStack.push([this.inProgress]);
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
      tracker += piece.length;
      if (tracker >= offset) {
        targetSlicePoint = piece.length - tracker + offset;
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
      } else if (lastConsumption.piece.mLength === -1) {
        lastConsumption.consumed = true;
        lastConsumption.piece = this.pieces.splice(index + 1, 2)[1] as existingPiece;
      }
    }
  }

  redo() {
    // if (this.redoStack.length > 0) {
    //   let newPiece = this.redoStack.pop();
    //   if (Array.isArray(newPiece)) {

    //   }
    //   else {

    //   }
    //   this.pieces.splice(newPiece.index, 0, newPiece);
    //   this.undoStack.push(this.undoStack.length);
    // }
  }

  undo() {
    if (this.isInProgress) {
      this.commit();
      this.chunk = '';
    }
    if (this.undoStack.length > 0) {
      // const undoStep = this.undoStack.length;
      const targets = this.undoStack.pop();
      const targetIdx = this.pieces.indexOf(targets[0].pieces[0]);

      if (targets[0] instanceof Added && targets[0].type === 'overwrite') {
        const subTargets = targets[0].pieces;

        // console.log(targets[0].consumption);
        let tpieces = targets[0].consumption.map(t => t.piece.pieces)
        // console.log(targets[0].consumption);
        // console.log(targets[0].consumption.map(t => t.piece))
        // console.log(tpieces);

        if (!last(targets[0].consumption).consumed) {
          const pieces = tpieces.pop()
          console.log(pieces);
          pieces[0].modified = last(targets[0].consumption).startMod - (pieces.length - 1) * targets[0].length;
          // for (const piece of pieces) {
          //   console.log(piece);
          //   piece.modified = last(targets[0].consumption).startMod - (pieces.length - 1);
          //   // tpieces.pop().modified += targets.reduce((p, c) => p + c.length, 0) - tpieces.reduce((p, c) => p + c.length, 0);
          // }
          // this.modifyNextPiece(targets.reduce((p, c) => p + c.length, 0) - tpieces.reduce((p, c) => p + c.length, 0), targetIdx + targets.length - 1, targets[0]);
        } else {
          console.log(last(tpieces));
          console.log(targets[0].consumption);
          last(tpieces).modified = last(targets[0].consumption).startMod
        }
        // for (const t of targets[0].consumption) {
        //   t.piece.modified = t.startMod;
        // }
        for (let i = 0; i < targets[0].consumption.length; i++) {
          targets[0].consumption[i].piece.modified = targets[0].consumption[i].startMod;
        }

        // // this.modifyNextPiece(targets.reduce((p, c) => p + c.length, 0) - tpieces.reduce((p, c) => p + c.length, 0), targetIdx + targets.length - 1);

        this.pieces.splice(targetIdx, targets.length, ...tpieces.map(p => p[0]));

        // this.pieces.splice(targetIdx, subTargets.length, );
      } else {
        this.pieces.splice(targetIdx, targets.length);
      }


      this.redoStack.push(targets);
      // console.log(this.pieces);
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

    this.undoStack[this.undoStack.length - 1][0] = newAddedPiece;
    this.added = newArr;
    this.inProgress = null;
    this.chunk = '';
  }

  rollback() {
    let chopLength = 0;
    while(this.redoStack.length > 0) {
      chopLength += this.redoStack.pop().length
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
