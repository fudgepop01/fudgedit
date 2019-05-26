import { HexEditor } from './hex-editor';

type editType = "insert" | "overwrite";
type source = "origin" | "added" | "inprogress";
type piece = {offset: number, length: number, source: source};
type inprogress = {offset: number, type: editType, content: number[], index: number, length: number};
type pieces = piece | inprogress;

function isInprogress(piece: pieces): piece is inprogress {
  if (piece && (piece as inprogress).content) return true;
  else return false;
}

export class editController {
  original: Uint8Array;
  added: Uint8Array = new Uint8Array();
  pieces: Array<pieces> = [];
  inProgress: inprogress;
  chunk: string = '';

  constructor(
    private parent: HexEditor
  ) {
    this.original = parent.file;
    this.pieces = [{offset: 0, length: this.original.length, source: "origin"}]
  }

  initEdit(offset: number, type: editType) {
    this.inProgress = {offset, type, content: [], index: -1, get length() {return this.content.length}};
    if (type === 'insert') {
      let tracker = 0;
      let targetSlicePoint: number;
      let targetIndex: number;
      let target: piece;
      for (const [i, piece] of (this.pieces as piece[]).entries()) {
        tracker += piece.length;
        if (tracker >= offset) {
          targetSlicePoint = piece.length - tracker + offset;
          targetIndex = i;
          target = piece;
          break;
        }
      }
      this.inProgress.index = targetIndex + 1;
      const toInsert: Array<pieces> = [
        {offset: target.offset, length: targetSlicePoint, source: target.source},
        this.inProgress,
        {offset: target.offset + targetSlicePoint, length: target.length - targetSlicePoint, source: target.source},
      ];

      this.pieces.splice(targetIndex, 1, ...toInsert);
    }
    else {
      let tracker = 0;
      let targetSlicePoint: number;
      let targetIndex: number;
      let target: piece;
      for (const [i, piece] of (this.pieces as piece[]).entries()) {
        tracker += piece.length;
        if (tracker >= offset) {
          targetSlicePoint = piece.length - tracker + offset;
          targetIndex = i;
          target = piece;
          break;
        }
      }
      this.inProgress.index = targetIndex + 1;
      const toInsert: Array<pieces> = [
        {offset: target.offset, length: targetSlicePoint, source: target.source},
        this.inProgress,
        {offset: target.offset + targetSlicePoint, length: target.length - targetSlicePoint, source: target.source},
      ];

      this.pieces.splice(targetIndex, 1, ...toInsert);
    }
  }

  buildEdit(keyStroke: KeyboardEvent) {
    if (/^[a-fA-F0-9]$/.test(keyStroke.key)) {
      this.chunk += keyStroke.key;
      if (this.chunk.length === 2) {
        this.inProgress.content.push(parseInt(this.chunk, 16));
        this.chunk = '';
        this.parent.cursor += 1;

        let index = this.pieces.indexOf(this.inProgress);
        if (this.inProgress.type === 'overwrite' && index !== this.pieces.length - 1) {
          const nextPiece = this.pieces[index + 1];
          nextPiece.offset += 1;
          nextPiece.length -= 1;
          if (nextPiece.length === 0) {
            this.pieces.splice(index + 1, 1);
          }
        }
      }
    }
  }

  commit() {
    let newArr = new Uint8Array(this.added.length + this.inProgress.content.length);
    newArr.set(this.added, 0);
    newArr.set(this.inProgress.content, this.added.length);

    this.pieces[this.inProgress.index] = {offset: this.added.length, length: this.inProgress.length, source: 'added'} as piece;

    console.log(this.pieces);

    this.added = newArr;
    this.inProgress = null;
    this.chunk = '';
  }

  render(start: number, length: number) {
    let out = new Uint8Array(length);
    let meta: {added: [number, number][]} = {added: []}

    let tracker = 0;
    let startPlace: number;
    let startIndex: number = 0;
    for (const [i, piece] of this.pieces.entries()) {
      tracker += piece.length;
      if (tracker >= start) {
        startPlace = piece.length - tracker + start;
        startIndex = i;
        break;
      }
    }


    if (isInprogress(this.pieces[startIndex]) || (this.pieces[startIndex] as piece).source === 'added') {
      meta.added.push([start - startPlace, start - startPlace + this.pieces[startIndex].length]);
    }
    let firstChunk = this.getPieceBuffer(this.pieces[startIndex]).subarray(startPlace, startPlace + length);
    tracker = firstChunk.length;
    out.set(firstChunk, 0);
    for (let i = startIndex + 1; i < this.pieces.length; i++) {
      let piece = this.pieces[i];
      tracker += piece.length;
      if (isInprogress(piece) || (piece as piece).source === 'added') {
        meta.added.push([start + tracker - piece.length, start + tracker]);
      }
      if (tracker >= length) {
        out.set(this.getPieceBuffer(piece).subarray(0, piece.length - tracker + length), tracker - piece.length);
        break;
      }
      out.set(this.getPieceBuffer(piece), tracker - piece.length);
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

  rollback() {

  }

  save() {

  }

  private getPieceBuffer(piece: pieces) {
    if (isInprogress(piece)) {
      return new Uint8Array(piece.content);
    }
    // implied else
    if (piece.source === 'origin') {
      return this.original.subarray(piece.offset, piece.offset+piece.length);
    } else {
      return this.added.subarray(piece.offset, piece.offset+piece.length);
    }

  }
}
