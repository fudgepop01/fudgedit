import { Component, State, Prop, Method, Event, EventEmitter, h, forceUpdate } from '@stencil/core';
import { EditController } from './editController';
import { EditingMode, Endianness, IRegion, SearchType, NonLetter } from './interfaces';
import { floatToBin } from './floatConverter';

@Component({
  tag: 'hex-editor',
  styleUrl: 'hex-editor.css',
  shadow: false
})
export class HexEditor {
  // SECTION OWN PROPERTIES

  editController: EditController;
  regionScaleWidth: number;
  regionScaleHeight: number;
  canUpdateMouseMove: boolean;

  // !SECTION OWN INTERNAL PROPERTIES

  // SECTION STATE

  /**
   * contains metadata of the given file
   * @type {File}
   * @memberof HexEditor
   */
  @State() fileMetadata: File;

  /**
   * the loaded file
   *
   * @type {Uint8Array}
   * @memberof HexEditor
   */
  @State() file: Uint8Array;

  // keeps track of which line is displayed
  @State() ln: number = 0;

  get lineNumber() { return Math.floor(this.ln); }
  set lineNumber(n: number) { this.ln = n; }

  // stores position of mousedown event
  tempSelection: {byte: number, bit: number};
  // keeps track of selected portion of hex/ascii
  @State() selection: {start: number, startBit: number, end: number, endBit: number};
  // keeps track of where exactly the cursor is
  @State() cursor: number;
  // keeps track of the bit the cursor has selected (if in binary mode)
  @State() bit: number;
  // keeps track of what part of the editor was last clicked
  @State() editingMode: EditingMode;

  // the type of search to be executed
  @State() searchType: SearchType = SearchType.ASCII;
  // number of bytes the search should have (used when integer or float)
  @State() searchByteCount: 1 | 2 | 4 | 8 = 1;
  // endianness of the search
  @State() searchEndian: Endianness = 'big';
  // input to search for
  @State() searchInput: string = '';
  // results of the search
  @State() searchResults: number[] = [];
  // whether or not to display the search window
  @State() searchActive: boolean = false;

  // !SECTION

  // SECTION PROPS

  /**
   * weather or not to display ASCII on the side
   *
   * @type {boolean}
   * @memberof HexEditor
   */
  @Prop() displayAscii: boolean = true;

  /**
   * weather or not to display Hex
   *
   * @type {boolean}
   * @memberof HexEditor
   */
  @Prop() displayHex: boolean = true;

  /**
   * weather or not to display binary
   *
   * @type {boolean}
   * @memberof HexEditor
   */
  @Prop() displayBin: boolean = false;

  /**
   * the number of lines to display at once
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() maxLines: number = 30;

  /**
   * the number of bytes to display per line
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() bytesPerLine: number = 16;

  
  /**
   * What character to put in place of invalid ASCII
   * @memberof HexEditor
   */
  @Prop() nonDisplayCharacter: NonLetter = NonLetter.DOT;

  /**
   * How Opaque these invalid ASCII characters will be
   * @memberof HexEditor
   */
  @Prop() nonDisplayOpacity: number = 0.45;

  /**
   * definitions for each chunk to display when
   * displayAsChunks is enabled
   *
   * @type {number[]}
   * @memberof HexEditor
   */
  @Prop() chunks: {
    title?: string;
    start: number;
    end: number;
  }[] = [];

  /**
   * displays the file as chunks (defined above)
   *
   * @type {boolean}
   * @memberof HexEditor
   */
  @Prop() displayAsChunks: boolean = false;

  /**
   * weather or not to replace typical ASCII values
   * with their ASCII value representation
   * ( ex: 0x61 ==> ".a" )
   *
   * @type {boolean}
   * @memberof HexEditor
   */
  @Prop() asciiInline: boolean = false;

  /**
   * the number of chunks between separators
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() bytesPerGroup: number = 4;

  /**
   * the number of bits between separators
   * on the bit display
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() bitsPerGroup: number = 8;

  /**
   * the mode of operation:
   * region:
   *    used to highlight different regions. Hovering over
   *    a region displays a tooltip
   * edit:
   *    regions are displayed in the background, allowing
   *    the user to edit directly
   * noregion:
   *    regions are not displayed at all
   *
   * @type {("region" | "edit" | "noregion")}
   * @memberof HexEditor
   */
  @Prop() mode: "region" | "select" | "noregion" = "select";

  /**
   * the mode of data entry:
   * insert:
   *    inserts data between bytes
   * overwrite:
   *    overwrites the currently selected byte
   * readonly:
   *    no edits are possible
   *
   * @type {("insert" | "overwrite" | "readonly")}
   * @memberof HexEditor
   */
  @Prop() editType: "insert" | "overwrite" | "readonly" = "readonly";

  /**
   * the number of regions to traverse
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() regionDepth: number = 2;

  /**
   * the region data. Data will be displayed in the tooltip
   * if mode is set to "region"
   *
   * @type {IRegion[]}
   * @memberof HexEditor
   */
  @Prop() regions: IRegion[] = [];

  // !SECTION

  // SECTION EVENTS

  /**
   * Emitted when the lineNumber changes
   *
   * @type {EventEmitter}
   * @memberof HexEditor
   */
  @Event() hexLineChanged: EventEmitter;

  /**
   * Emitted on the change of the cursor's position
   *
   * @type {EventEmitter}
   * @memberof HexEditor
   */
  @Event() hexCursorChanged: EventEmitter;

  /**
   * Emitted when the selection changes
   *
   * @type {EventEmitter}
   * @memberof HexEditor
   */
  @Event() hexSelectionChanged: EventEmitter;

  /**
   * fired when the file's data changes
   *
   * @type {EventEmitter}
   * @memberof HexEditor
   */
  @Event() hexDataChanged: EventEmitter;

  /**
   * fired when the component loads
   */
  @Event() hexLoaded: EventEmitter;

  // !SECTION

  // SECTION COMPONENT LIFECYCLE METHODS

  componentWillLoad() {
    this.file = new Uint8Array(1024).map((_, i) => i % 256);

    this.editController = new EditController(this);
    this.regionScaleWidth = 28;
    this.regionScaleHeight = 17;
  }

  componentDidLoad() {
    this.hexLoaded.emit(this.editController);
  }

  // !SECTION

  // SECTION LISTENERS
  // !SECTION

  // SECTION EXPOSED API

  /**
  * accepts and reads the given file, storing the result in
  * the file variable
  * @param file
  */
  @Method()
  async acceptFile(file: File) {
    console.log(file);
    this.fileMetadata = file;

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (event) => {
      this.file = new Uint8Array((event.target as any).result);
      this.editController = new EditController(this);
    }
  }

  /**
   * returns the edited file
   *
   * @returns {(Promise<Uint8Array | void>)}
   * @memberof HexEditor
   */
  @Method()
  async saveFile(): Promise<Uint8Array | void> {
    if (this.file == undefined) return;
    return this.editController.save();
  }

  /**
   * sets the line number
   *
   * @param {number} newLineNumber
   * @memberof HexEditor
   */
  @Method()
  async setLineNumber(newLineNumber: number) {
    if (newLineNumber < 0) this.lineNumber = 0;
    else this.lineNumber = newLineNumber;
    this.hexLineChanged.emit(this.lineNumber);
  }

  /**
   * sets the new cursor position
   *
   * @param {number} newCursorPosition
   * @memberof HexEditor
   */
  @Method()
  async setCursorPosition(newCursorPosition: number, bit?: number) {
    if (bit) {
      let adjustMain = 0;
      if (bit >= 8) adjustMain = Math.floor(bit / 8);
      this.cursor = newCursorPosition + adjustMain;
      this.bit = bit % 8;
    } else {
      this.cursor = newCursorPosition;
    }

    this.hexCursorChanged.emit({byte: this.cursor, bit: this.bit});
  }

  /**
   * sets the new selection bounds.
   * @param {{start?: number, end?: number}} newSelection
   * @memberof HexEditor
   */
  @Method()
  async setSelection(newSelection: {start?: number, end?: number, startBit?: number, endBit?: number}) {
    this.selection = {...this.selection, ...newSelection};
    this.hexSelectionChanged.emit(this.selection);
  }

  /**
   * fetches a Uint8Array of a given length
   * at the given location
   * @param location where to fetch the data from
   * @param length how many bytes to load
   * @memberof HexEditor
   */
  @Method()
  async getChunk(location: number, length: number) {
    return this.editController.render(location, length);
  }

  /**
   * returns the file's metadata
   * @memberof HexEditor
   */
  @Method()
  async getFileMetadata() {
    return this.fileMetadata;
  }

  /**
   * executes a search in the currently loaded file with the supplied parameters
   *
   * @param {string} text
   * @param {SearchType} searchType
   * @param {[number, number]} range
   * @param {(1 | 2 | 4 | 8)} [searchByteCount]
   * @param {('big' | 'little')} [searchEndian]
   * @memberof HexEditor
   */
  @Method()
  async executeSearch(
    text: string,
    searchType: SearchType,
    range?: [number, number],
    searchByteCount?: 1 | 2 | 4 | 8,
    searchEndian?: 'big' | 'little',
  ) {
    let searchArr;
    try {
      searchArr = this.formatSearch(text, searchType, searchByteCount, searchEndian);
    } catch(e) {
      console.log(e);
    }

    this.searchResults = this.editController.find(searchArr, range ? range[0] : 0, range ? range[1] - range[0] : undefined);
    return this.searchResults;
  }

  // !SECTION

  // LOCAL METHODS

  /**
   * builds the elements responsible for the hex view
   */
  buildHexView() {
    const { lineNumber, maxLines, bytesPerLine, bytesPerGroup, bitsPerGroup, asciiInline } = this;
    const start = lineNumber * bytesPerLine;

    const chunkData = this.editController.render(start, maxLines * bytesPerLine);
    const chunk = chunkData.out;
    const addedRanges = chunkData.meta.added;

    const lines: Uint8Array[] = [];
    for (let i = 0; i < maxLines; i++) {
      lines.push(chunk.subarray(i * bytesPerLine, (i+1) * bytesPerLine));
    }

    const binViews = [];
    const lineViews = [];
    const charViews = [];
    let selectedLine = -1;
    for (const [lineNum, line] of lines.entries()) {
      if (line.length === 0) break;

      // setup variables
      const base = start + lineNum * bytesPerLine;
      const binLines = [];
      const charLines = [];
      const hexLines = [];
      let ascii: string = this.nonDisplayCharacter;
      document.documentElement.style.setProperty('--nd-opacity', `${this.nonDisplayOpacity}`);

      // sets up everything else.
      for (const [position, val] of [...line.values()].entries()) {
        let out: string;
        // classes
        const classList = [];
        if (/\w|[!@#$%^&*()_+=\]\\:;"'>.<,/?]/.test(String.fromCharCode(val))) {
          ascii = String.fromCharCode(val);
        } else { 
          classList.push("nonDisplay");
          ascii = this.nonDisplayCharacter;
        }

        if (asciiInline && /\w/.test(ascii)) { out = "." + ascii; }
        else { out = val.toString(16).toUpperCase().padStart(2, '0'); }

        
        if (out.startsWith('.')) classList.push('ASCII');
        if (position % bytesPerGroup === bytesPerGroup - 1) classList.push('padByte');
        if (Math.floor(this.cursor) === base + position) {
          classList.push('cursor');
          selectedLine = lineNum;
        }
        if (this.selection && this.selection.start <= base + position && base + position <= this.selection.end) classList.push('selected');
        for (const [start, end] of addedRanges) {
          if (start <= base + position && base + position < end) {
            classList.push('added');
            break;
          }
        }

        // binary spans are more complicated than the others
        // they are split into 8 pieces (the 8 bits that make up a byte)
        let binArr = val.toString(2).padStart(8, '0').split('');
        let binSpans = [];
        if (this.displayBin) {
          for (let i = 0; i < binArr.length; i++) {
            let binClass = '';
            if ((position * 8 + i) % bitsPerGroup == bitsPerGroup - 1) binClass += 'padBit';
            if (classList.includes('cursor') && (this.bit === i || this.bit === -1)) binClass += ' cursor';
            if (classList.includes('selected')) {
              if (this.selection.start === this.selection.end) {
                if (i >= this.selection.startBit && i <= this.selection.endBit)
                  binClass += ' selected';
              }
              else if (this.selection.start === base + position) {
                if (i >= this.selection.startBit) binClass += ' selected';
              }
              else if (this.selection.end === base + position) {
                if (i <= this.selection.endBit || this.selection.endBit === -1) binClass += ' selected';
              }
              else binClass += ' selected';
            }
            binSpans.push(<span data-cursor-idx={i} class={binClass}>{binArr[i]}</span>);
          }
        }

        if (this.displayBin) binLines.push(<span data-cursor-idx={base + position} class={"binGroup" + (classList.includes('added') ? ' added' : '')}>{binSpans}</span>)
        if (this.displayAscii) charLines.push(<span data-cursor-idx={base + position} class={classList.join(' ')}>{ascii}</span>);
        if (this.displayHex) hexLines.push(<span data-cursor-idx={base + position} class={classList.join(' ')}>{out}</span>);
      }

      if (this.displayBin) binViews.push((
        <div class={'binLine' + (selectedLine === lineNum ? ' selected' : '')}>{binLines}</div>
      ))

      if (this.displayHex) {
        lineViews.push((
          <div class={'hexLine' + (selectedLine === lineNum ? ' selected' : '')}>{hexLines}</div>
        ));
      } else {
        lineViews.push({});
      }

      if (this.displayAscii) charViews.push((
        <div class={'charLine' + (selectedLine === lineNum ? ' selected' : '')}>{charLines}</div>
      ))

    }

    // fill extra space
    while (lineViews.length < maxLines) {
      binViews.push(<div class="binLine" style={{pointerEvents: 'none'}}><span>-</span></div>);
      lineViews.push(<div class="hexLine" style={{pointerEvents: 'none'}}><span>-</span></div>);
      charViews.push(<div class="charLine" style={{pointerEvents: 'none'}}><span>-</span></div>);
    }

    // line number builder
    const lineLabels = [];
    for (let i = 0; i < maxLines; i++) {
      lineLabels.push(<div class={'lineLabel' + (selectedLine === i ? ' selected' : '')} style={{pointerEvents: 'none'}}>{'0x' + (start + i * bytesPerLine).toString(16).padStart(8, ' ')}</div>)
    }

    // regions

    const binRegionMarkers = [];
    const hexRegionMarkers = [];
    const asciiRegionMarkers = [];

    const buildRegion = (region: IRegion, depth = 0, index?: number) => {
      if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) {
        if (region.subRegions && depth + 1 !== this.regionDepth) {
          for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
        }
        return;
      };

      if (depth === this.regionDepth) return;

      // start / end offsets
      const s = region.start % this.bytesPerLine;
      const e = region.end % this.bytesPerLine;

      // l is the "height" of the region. It was a bit confusing, so allow me to explain:
      // instead of only taking into account the start and end of the region's offsets,
      // what we ACTUALLY want is the start and end while taking into account the offset
      // provided by 's'
      const l = Math.floor((region.end - region.start + s) / this.bytesPerLine);

      const offset = Math.floor(region.start / this.bytesPerLine) - lineNumber;

      const getColor = {
        0: ['#88F', '#BBF'],
        1: ['#F88', '#FBB'],
        2: ['#8D8', '#BDB']
      }

      const genPolygon = (width: number, height: number) => (
          <polygon
            onMouseMove={
              (evt: MouseEvent) => {
                if (document.getElementById('tooltip').getAttribute('active') === "frozen") return;
                if (this.canUpdateMouseMove === undefined) {
                  this.canUpdateMouseMove = true;
                }
                if (this.canUpdateMouseMove) {
                  this.canUpdateMouseMove = false;
                  document.documentElement.style.setProperty('--mouse-x', `${evt.clientX}`);
                  document.documentElement.style.setProperty('--mouse-y', `${evt.clientY}`);
                  document.getElementById('tooltip').setAttribute('active', 'true')
                  document.getElementById('tooltip').setAttribute('complex', `${JSON.stringify({...region, subRegions: region.subRegions ? region.subRegions.map(sr => sr.name) : null})}`);

                  setTimeout(() => {this.canUpdateMouseMove = true}, 50);
                }
              }
            }
            onMouseLeave={
              () => { 
                if (document.getElementById('tooltip').getAttribute('active') === "true")
                  document.getElementById('tooltip').setAttribute('active', 'false')
              }
            }
            onClick={
              (evt: MouseEvent) => {
                if (document.getElementById('tooltip').getAttribute('active') === "frozen") {
                  if (document.getSelection().anchorNode?.parentElement?.parentElement?.tagName === "HEX-TOOLTIP") {
                    document.getSelection().empty();
                  }
                  document.documentElement.style.setProperty('--mouse-x', `${evt.clientX}`);
                  document.documentElement.style.setProperty('--mouse-y', `${evt.clientY}`);
                  document.getElementById('tooltip').setAttribute('active', 'true')
                  document.getElementById('tooltip').setAttribute('complex', `${JSON.stringify({...region, subRegions: region.subRegions ? region.subRegions.map(sr => sr.name) : null})}`);
                } else {
                  document.getElementById('tooltip').setAttribute('active', 'frozen');
                  document.documentElement.style.setProperty('--mouse-x', `${evt.clientX - 10}`);
                  document.documentElement.style.setProperty('--mouse-y', `${evt.clientY - 10}`);
                };
              }
            }
            class="region"
            points={`
              0,${(1 + offset) * height}
              ${s * width},${(1 + offset) * height}
              ${s * width},${offset * height}
              ${this.bytesPerLine * width},${offset * height}
              ${this.bytesPerLine * width},${(l + offset) * height}
              ${e * width},${(l + offset) * height}
              ${e * width},${(l + offset + 1) * height}
              0,${(l+1 + offset) * height}
            `} fill={region.color || getColor[depth % 3][index % 2]} stroke="none"
          />
        )

      binRegionMarkers.push(genPolygon(14 * 8, this.regionScaleHeight));
      hexRegionMarkers.push(genPolygon(this.regionScaleWidth, this.regionScaleHeight));
      asciiRegionMarkers.push(genPolygon(10, this.regionScaleHeight));
      // if regions don't work right in the future then the if condition below is the reason why
      if (region.subRegions && depth + 1 !== this.regionDepth) {
        for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
      }
      // }
    }

    for (const [i, region] of this.regions.entries()) {
      buildRegion(region, 0, i);
    }
    // style={{width: this.bytesPerLine * this.regionScaleWidth, height: this.maxLines * this.regionScaleHeight}}

    const binRegions = <svg viewBox={`0 0 ${this.bytesPerLine * 14 * 8} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * 14 * 8}`} height={`${this.maxLines * this.regionScaleHeight}`}>{binRegionMarkers}</svg>
    const hexRegions = <svg viewBox={`0 0 ${this.bytesPerLine * this.regionScaleWidth} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * this.regionScaleWidth}`} height={`${this.maxLines * this.regionScaleHeight}`}>{hexRegionMarkers}</svg>
    const asciiRegions = <svg viewBox={`0 0 ${this.bytesPerLine * 10} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * 10}`} height={`${this.maxLines * this.regionScaleHeight}`}>{asciiRegionMarkers}</svg>
    return {
      lineViews,
      charViews,
      binViews,
      lineLabels,
      binRegions,
      hexRegions,
      asciiRegions
    }
  }

  buildChunks() {
    const { lineNumber, maxLines, bytesPerLine, bytesPerGroup, chunks, bitsPerGroup, asciiInline } = this;
    // console.log(lineNumber);
    const chunkOffset = {
      chunk: 0,
      chunkLineOffs: 0
    };
    // get offset data for the generated chunks
    for (let lNum = lineNumber, j = 0; lNum > 0 && j < chunks.length; lNum--, j++) {
      const acc = Math.floor((chunks[j].end - chunks[j].start) / bytesPerLine) + 1;
      lNum -= acc;
      if (lNum > 0) chunkOffset.chunk += 1;
      else chunkOffset.chunkLineOffs = acc - lNum * -1;
    }

    // render the chunks, rendering
    // only the parts that are visible
    const renderedChunks: {
      data: Uint8Array,
      start: number,
      startLine: number,
      endLine: number,
    }[] = [];
    for (let i = chunkOffset.chunk, lineCount = 0; lineCount < maxLines && i < chunks.length; i++) {
      const startLine = lineCount;
      const chunk = chunks[i];
      let actualStart = chunk.start;
      if (i == chunkOffset.chunk) actualStart += bytesPerLine * chunkOffset.chunkLineOffs;
      if (chunk.end - actualStart <= 0) {
        // renderedChunks.push({data: new Uint8Array(0), start: -1, startLine: -1, endLine: -1});
        continue;
      }
      lineCount += Math.ceil((chunk.end - actualStart) / bytesPerLine);

      let actualEnd = chunk.end;
      if (lineCount > maxLines) actualEnd -= (lineCount - maxLines) * bytesPerLine;
      // console.log(actualEnd - actualStart);
      const rendered = this.editController.render(actualStart, actualEnd - actualStart).out;

      renderedChunks.push({start: actualStart, data: rendered, startLine, endLine: lineCount});
      for (let j = 0; j < 1; j++) {
        lineCount += 1;
        renderedChunks.push({data: new Uint8Array(0), start: -1, startLine: -1, endLine: -1});
      }


    }
    renderedChunks.pop();

    let lineViews = [];
    let charViews = [];
    let binViews = [];
    let lineLabels = [];

    const binRegionMarkers = [];
    const hexRegionMarkers = [];
    const asciiRegionMarkers = [];

    for (const {start, data, startLine} of renderedChunks) {
      if (start === -1) {
        lineLabels.push(<div class='separator' style={{pointerEvents: 'none'}}>NA</div>)
        lineViews.push(<div class='separator' style={{pointerEvents: 'none'}}>NA</div>)
        charViews.push(<div class='separator' style={{pointerEvents: 'none'}}>NA</div>)
        binViews.push(<div class='separator' style={{pointerEvents: 'none'}}>NA</div>)
        continue;
      }
      for (let i = 0; i < data.length; i += bytesPerLine) {
        const lineStart = start + i;
        const hexLine = [];
        const charLine = [];
        const binLine = [];
        let selectedLine = -1;
        for (let j = i; j < i + bytesPerLine && j < data.length; j++) {
          const val = data[j];
          const position = start + j;

          let out: string;
          let ascii: string;
          if (/\w|[!@#$%^&*()_+=\]\\:;"'>.<,/?]/.test(String.fromCharCode(val))) {
            ascii = String.fromCharCode(val);
          } else { ascii = this.nonDisplayCharacter; }

          if (asciiInline && /\w/.test(ascii)) { out = "." + ascii; }
          else { out = val.toString(16).toUpperCase().padStart(2, '0'); }

          // classes
          const classList = [];
          if (out.startsWith('.')) classList.push('ASCII');
          if ((j - i) % bytesPerGroup === bytesPerGroup - 1) classList.push('padByte');
          if (Math.floor(this.cursor) === position) {
            classList.push('cursor');
            selectedLine = lineStart;
          }
          if (this.selection && this.selection.start <= position && position <= this.selection.end) classList.push('selected');

          // binary spans are more complicated than the others
          // they are split into 8 pieces (the 8 bits that make up a byte)
          let binArr = val.toString(2).padStart(8, '0').split('');
          let binSpans = [];
          if (this.displayBin) {
            for (let k = 0; k < binArr.length; k++) {
              let binClass = '';
              if ((position * 8 + k) % bitsPerGroup == bitsPerGroup - 1) binClass += 'padBit';
              if (classList.includes('cursor') && (this.bit === k || this.bit === -1)) binClass += ' cursor';
              if (classList.includes('selected')) {
                if (this.selection.start === this.selection.end) {
                  if (k >= this.selection.startBit && k <= this.selection.endBit)
                    binClass += ' selected';
                }
                else if (this.selection.start == position) {
                  if (k >= this.selection.startBit) binClass += ' selected';
                }
                else if (this.selection.end == position) {
                  if (k <= this.selection.endBit || this.selection.endBit === -1) binClass += ' selected';
                }
                else binClass += ' selected';
              }
              binSpans.push(<span data-cursor-idx={k} class={binClass}>{binArr[k]}</span>);
            }
          }

          if (this.displayBin) binLine.push(<span data-cursor-idx={position} class={"binGroup" + (classList.includes('added') ? ' added' : '')}>{binSpans}</span>)
          if (this.displayAscii) charLine.push(<span data-cursor-idx={position} class={classList.join(' ')}>{ascii}</span>);
          if (this.displayHex) hexLine.push(<span data-cursor-idx={position} class={classList.join(' ')}>{out}</span>);
        }

        lineLabels.push((
          <div class={'lineLabel' + (selectedLine === lineStart ? ' selected' : '')} style={{pointerEvents: 'none'}}>{'0x' + (lineStart).toString(16).padStart(8, ' ')}</div>
        ))

        if (this.displayBin) binViews.push((
          <div class={'binLine' + (selectedLine === lineStart ? ' selected' : '')}>{binLine}</div>
        ))

        if (this.displayHex) {
          lineViews.push((
            <div class={'hexLine' + (selectedLine === lineStart ? ' selected' : '')}>{hexLine}</div>
          ));
        } else {
          lineViews.push({});
        }

        if (this.displayAscii) charViews.push((
          <div class={'charLine' + (selectedLine === lineStart ? ' selected' : '')}>{charLine}</div>
        ))

      }

      const buildRegion = (region: IRegion, depth = 0, index?: number) => {
        const lineCount = Math.floor(data.length / bytesPerLine);
        const horizOffset = start % bytesPerLine;

        if (region.end < start || region.start > start + lineCount * bytesPerLine) {
          if (region.subRegions && depth + 1 !== this.regionDepth) {
            for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
          }
          return;
        };

        if (depth === this.regionDepth) return;

        const startByte = Math.max(region.start, start);
        const endByte = Math.min(region.end, start + data.length);

        const s = (startByte - horizOffset) % bytesPerLine;
        const e = (endByte - horizOffset) % bytesPerLine;

        const l = Math.floor((endByte - startByte + s) / bytesPerLine);

        const vertOffset = (Math.floor((startByte - start) / bytesPerLine) + startLine);
        // console.log(startLine)
        // console.log(idx, startByte.toString(16), vertOffset);

        const getColor = {
          0: ['#88F', '#BBF'],
          1: ['#F88', '#FBB'],
          2: ['#8D8', '#BDB']
        };

        const genPolygon = (width: number, height: number) => (
          <polygon
            onMouseMove={
              (evt: MouseEvent) => {
                if (this.canUpdateMouseMove === undefined) {
                  this.canUpdateMouseMove = true;
                }
                if (this.canUpdateMouseMove) {
                  this.canUpdateMouseMove = false;
                  document.documentElement.style.setProperty('--mouse-x', `${evt.clientX}`);
                  document.documentElement.style.setProperty('--mouse-y', `${evt.clientY}`);
                  document.getElementById('tooltip').setAttribute('active', 'true')
                  document.getElementById('tooltip').setAttribute('complex', `${JSON.stringify({...region, subRegions: region.subRegions ? region.subRegions.map(sr => sr.name) : null})}`);

                  setTimeout(() => {this.canUpdateMouseMove = true}, 50);
                }
              }
            }
            onMouseLeave={() => document.getElementById('tooltip').setAttribute('active', 'false')}
            class="region"
            points={`
              0,${(1 + vertOffset) * height}
              ${s * width},${(1 + vertOffset) * height}
              ${s * width},${vertOffset * height}
              ${this.bytesPerLine * width},${vertOffset * height}
              ${this.bytesPerLine * width},${(l + vertOffset) * height}
              ${e * width},${(l + vertOffset) * height}
              ${e * width},${(l + vertOffset + 1) * height}
              0,${(l+1 + vertOffset) * height}
            `} fill={region.color || getColor[depth % 3][index % 2]} stroke="none"
          />
        )

        binRegionMarkers.push(genPolygon(14 * 8, this.regionScaleHeight));
        hexRegionMarkers.push(genPolygon(this.regionScaleWidth, this.regionScaleHeight));
        asciiRegionMarkers.push(genPolygon(10, this.regionScaleHeight));
        // if regions don't work right in the future then the if condition below is the reason why
        if (region.subRegions && depth + 1 !== this.regionDepth) {
          for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
        }

      }

      for (const [i, region] of this.regions.entries()) {
        buildRegion(region, 0, i);
      }
    }

    while (lineViews.length < maxLines) {
      lineLabels.push(<div class="separator" ><span>-</span></div>)
      binViews.push(<div class="separator" ><span>-</span></div>);
      lineViews.push(<div class="separator" ><span>-</span></div>);
      charViews.push(<div class="separator" ><span>-</span></div>);
    }

    const binRegions = <svg viewBox={`0 0 ${this.bytesPerLine * 14 * 8} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * 14 * 8}`} height={`${this.maxLines * this.regionScaleHeight}`}>{binRegionMarkers}</svg>
    const hexRegions = <svg viewBox={`0 0 ${this.bytesPerLine * this.regionScaleWidth} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * this.regionScaleWidth}`} height={`${this.maxLines * this.regionScaleHeight}`}>{hexRegionMarkers}</svg>
    const asciiRegions = <svg viewBox={`0 0 ${this.bytesPerLine * 10} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * 10}`} height={`${this.maxLines * this.regionScaleHeight}`}>{asciiRegionMarkers}</svg>

    return {
      lineViews,
      charViews,
      binViews,
      lineLabels,
      binRegions,
      hexRegions,
      asciiRegions
    }

  }

  /**
   * edits the underlying uint8array or
   * adjusts the cursor position
   *
   * @param {KeyboardEvent} evt
   * @returns
   * @memberof HexEditor
   */
  edit(evt: KeyboardEvent) {
    if ((evt.target as HTMLElement).className !== 'hex') return;
    const evtArrowKeyConditions = {
      ArrowDown: () => {
        this.setCursorPosition(
          (this.cursor + this.bytesPerLine > this.editController.length)
          ? this.editController.length
          : this.cursor + this.bytesPerLine)
      },
      ArrowUp: () => { this.setCursorPosition((this.cursor - this.bytesPerLine < 0) ? 0 : this.cursor - this.bytesPerLine) },
      ArrowRight: () => {
        this.setCursorPosition(
          (this.cursor + 1 > this.editController.length)
          ? this.editController.length
          : this.cursor + 1)
      },
      ArrowLeft: () => { this.setCursorPosition((this.cursor - 1 < 0) ? 0 : this.cursor - 1) }
    }
    if (evtArrowKeyConditions[evt.key]) {
      evt.preventDefault();
      // commits/ends any edits
      if (this.editController.inProgress) this.editController.commit();
      // executes key function
      evtArrowKeyConditions[evt.key]();
      // adjusts scroll / selection based on new cursor position
      if (this.cursor > (this.lineNumber + this.maxLines) * this.bytesPerLine - 1)
        this.setLineNumber(Math.floor(this.cursor / this.bytesPerLine) - this.maxLines + 1)
      else if (this.cursor < this.lineNumber * this.bytesPerLine)
        this.setLineNumber(Math.floor(this.cursor / this.bytesPerLine))
      // adjusts selection if shift key is held
      if (evt.shiftKey) {
        if (this.selection.start > this.cursor) this.setSelection({start: this.cursor});
        else this.setSelection({end: this.cursor});
      } else {
        this.setSelection({start: this.cursor, end: this.cursor})
      }
    } else if ((evt.ctrlKey || evt.metaKey) && evt.key === 'f') {
      // toggles find window
      evt.preventDefault();
      this.searchActive = !this.searchActive;
      forceUpdate(this);
    } else {
      if (this.editType === 'readonly') return;
      evt.preventDefault();
      this.editController.buildEdit(evt);
    }
  }

  /**
   * turns the search input from the type into an array of numbers
   * that represent its binary equivalent in the format specified
   *
   * @param {string} text
   * @param {SearchType} searchType
   * @param {(1 | 2 | 4 | 8)} [searchByteCount]
   * @param {('big' | 'little')} [searchEndian]
   * @returns {number[]}
   * @memberof HexEditor
   */
  formatSearch(
    text: string,
    searchType: SearchType,
    searchByteCount?: 1 | 2 | 4 | 8,
    searchEndian?: 'big' | 'little'
  ): number[] {
    if (text.length === 0) throw new Error('LEN0: there needs to be something to search for...');
    switch(searchType) {
      case SearchType.INTEGER:
        const max = parseInt('0x' + new Array(searchByteCount + 1).join('FF'), 16);
        let v = parseInt(text);
        if (Math.abs(v) > max) {
          v = max * Math.sign(v);
        }
        const out = v.toString(16).padStart(2 * searchByteCount, '0').match(/.{2}/g).map(v => parseInt(v, 16));
        if (searchEndian === 'little') out.reverse();
        return out;
      case SearchType.FLOAT:
        return floatToBin(parseFloat(text), searchByteCount, searchEndian)
      case SearchType.BYTE:
        if (/[^0-9a-f ,|;]/ig.test(text)) throw new Error('UC: Unexpected Character (must be exclusively 0-9 and a-f)')
        else {
          return text.replace(/[ ,|;]/ig, '').match(/.{2}/g).map(v => parseInt(v, 16));
        }
      case SearchType.ASCII:
      default:
        return text.split('').map(ch => ch.charCodeAt(0));
    }
  }

  /**
   * triggers a find operation on the currently selected chunk
   * if there is one, otherwise it searches the full thing
   *
   * @memberof HexEditor
   */
  async findInSelection() {
    const range = this.selection ? this.selection.end - this.selection.start : 0;
    this.searchResults =
      await this.executeSearch(
        this.searchInput,
        this.searchType,
        range === 0
          ? undefined
          : [ this.selection.start, this.selection.end ],
        this.searchByteCount,
        this.searchEndian);
  }

  /**
   * displays the full hexidecimal view
   */
  showHex() {
    const { lineViews, binViews, charViews, lineLabels, binRegions, hexRegions, asciiRegions } = this.buildHexView();

    let searchHexDisplay;
    try {
      searchHexDisplay =
        this.formatSearch(this.searchInput, this.searchType, this.searchByteCount, this.searchEndian)
          .map(v => v.toString(16).padStart(2, '0')).join(', ');
    } catch (e) {
      if (e.message.startsWith('LEN0')) searchHexDisplay = '';
      else searchHexDisplay = e.message;
    }

    let searchResults;
    if (this.searchActive) {
      const jumpToResult = (val: string) => {
        let v = parseInt(val);
        this.setCursorPosition(v);
        this.setSelection({
          start: v,
          end: v + (([SearchType.INTEGER, SearchType.FLOAT].includes(this.searchType)) ? this.searchByteCount : this.searchInput.length) - 1,
          startBit: -1,
          endBit: -1
        })
        this.setLineNumber(Math.floor(v / this.bytesPerLine) - this.maxLines / 2)
      }
      searchResults = (
        <select onChange={(evt) => jumpToResult((evt.target as HTMLSelectElement).value)}>
          {this.searchResults.map(v =>
            <option value={v}>{`0x${v.toString(16)}`}</option>
          )}
        </select>
      )
    }

    return (
      <div class="hex"
        onMouseEnter={(evt) => this._toggleScrollListener(evt)}
        onMouseLeave={(evt) => this._toggleScrollListener(evt)}
        onMouseDown={(evt) => this.beginSelection(evt)}
        onMouseUp={(evt) => this.endSelection(evt)}
        
        tabindex="0"
        onKeyDown={(evt) => this.edit(evt)}
      >
        <div id="MEASURE" class="hex" style={{position: 'absolute', visibility: 'hidden', padding: '0 5px'}}>AB</div>
        <div class="lineLabels">
          {lineLabels}
        </div>
        {this.displayBin ?
          <div class="binView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {binRegions}
            </div>
            <div class="main">
              {binViews}
            </div>
          </div>
        : null}
        {this.displayHex ?
          <div class="hexView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {hexRegions}
            </div>
            <div class="main">
              {lineViews}
            </div>
          </div>
        : null}
        {this.displayAscii ?
          <div class="asciiView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {asciiRegions}
            </div>
            <div class="main">
              {charViews}
            </div>
          </div>
          : null}
        {this.searchActive ?
          <div class="find">
            search: 
            <input type="text" onChange={(evt) => this.searchInput = (evt.target as HTMLInputElement).value} />
            <select onChange={(evt) => this.searchType = (evt.target as HTMLSelectElement).value as any}>
              <option value={SearchType.ASCII}>ASCII string</option>
              <option value={SearchType.BYTE}>bytes</option>
              <option value={SearchType.INTEGER}>integer</option>
              <option value={SearchType.FLOAT}>float</option>
            </select>
            {([SearchType.INTEGER, SearchType.FLOAT].includes(this.searchType)) ? [
              <select onChange={(evt) => this.searchByteCount = parseInt((evt.target as HTMLSelectElement).value) as any}>
                <option value="1">1 byte</option>
                <option value="2">2 bytes</option>
                <option value="4">4 bytes</option>
                <option value="8">8 bytes</option>
              </select>,
              <select onChange={(evt) => this.searchEndian = (evt.target as HTMLSelectElement).value as any}>
                <option value="big">big endian</option>
                <option value="little">little endian</option>
              </select>
            ]
            : null}
            <button onClick={() => this.findInSelection()}>search</button>
            <br/>
            hex: {searchHexDisplay} | results: {searchResults}
          </div>
        : null}
      </div>
    );
  }

  /**
   * displays the chunks
   *
   * @memberof HexEditor
   */
  showChunks() {
    const {
      lineViews,
      binViews,
      charViews,
      lineLabels,
      binRegions,
      hexRegions,
      asciiRegions
    } = this.buildChunks();


    return (
      <div class="hex"
        onMouseEnter={(evt) => this._toggleScrollListener(evt)}
        onMouseLeave={(evt) => this._toggleScrollListener(evt)}
        onMouseDown={(evt) => this.beginSelection(evt)}
        onMouseUp={(evt) => this.endSelection(evt)}

        tabindex="0"
        onKeyDown={(evt) => this.edit(evt)}
      >
        <div id="MEASURE" class="hex" style={{position: 'absolute', visibility: 'hidden', padding: '0 5px'}}>AB</div>
        <div class="lineLabels">
          {lineLabels}
        </div>
        {this.displayBin ?
          <div class="binView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {binRegions}
            </div>
            <div class="main">
              {binViews}
            </div>
          </div>
        : null}
        {this.displayHex ?
          <div class="hexView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {hexRegions}
            </div>
            <div class="main">
              {lineViews}
            </div>
          </div>
        : null}
        {this.displayAscii ?
          <div class="asciiView">
            <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
              {asciiRegions}
            </div>
            <div class="main">
              {charViews}
            </div>
          </div>
          : null}
      </div>
    );
  }

  /**
   * gets the exact position of
   * @param evt the mousedown event
   */
  beginSelection(evt: any) {
    if ((evt.target as HTMLElement).id === 'HEX-SCROLLBAR') return;
    if ((evt.target as HTMLElement).parentElement.tagName == "svg") return;
    const parentClassName = (evt.target as HTMLElement).parentElement.className;
    if (!parentClassName) return;
    if (parentClassName.includes('charLine')) this.editingMode = EditingMode.ASCII;
    else if (parentClassName.includes('hexLine')) this.editingMode = EditingMode.BYTE;
    else if (parentClassName.includes('binGroup')) this.editingMode = EditingMode.BIT;
    else return;

    if (this.editingMode === EditingMode.BIT) {
      this.tempSelection = {
        byte: parseInt(evt.composedPath()[1].getAttribute('data-cursor-idx')),
        bit: parseInt(evt.target.getAttribute('data-cursor-idx'))
      }
    }
    else {
      this.tempSelection = {
        byte: parseInt(evt.target.getAttribute('data-cursor-idx')),
        bit: -1
      }
    }

  }

  endSelection(evt: any) {
    if (this.tempSelection === null) return;

    if ((evt.target as HTMLElement).parentElement.tagName == "svg") return;
    const parentClassName = (evt.target as HTMLElement).parentElement.className;
    if (parentClassName.includes('charLine')) this.editingMode = EditingMode.ASCII;
    else if (parentClassName.includes('hexLine')) this.editingMode = EditingMode.BYTE;
    else if (parentClassName.includes('binGroup')) this.editingMode = EditingMode.BIT;
    else return;

    let chosen;
    if (this.editingMode === EditingMode.BIT) {
      chosen = {
        byte: parseInt(evt.composedPath()[1].getAttribute('data-cursor-idx')),
        bit: parseInt(evt.target.getAttribute('data-cursor-idx'))
      }
    }
    else {
      chosen = {
        byte: parseInt(evt.target.getAttribute('data-cursor-idx')),
        bit: -1
      }
    }

    if (this.tempSelection.byte + this.tempSelection.bit / 10 > chosen.byte + chosen.bit / 10) {
      this.setSelection({
        start: chosen.byte,
        startBit: chosen.bit,
        end: this.tempSelection.byte,
        endBit: this.tempSelection.bit
      })
    } else {
      this.setSelection({
        start: this.tempSelection.byte,
        startBit: this.tempSelection.bit,
        end: chosen.byte,
        endBit: chosen.bit
      })
    }

    this.tempSelection = null;
    this.cursor = chosen.byte;
    this.bit = chosen.bit;

    this.hexCursorChanged.emit({byte: this.cursor, bit: this.bit});
    this.hexSelectionChanged.emit(this.selection);

    if (this.editController.isInProgress) {
      this.editController.commit();
      this.hexDataChanged.emit();
    }
  }

  /**
   * This must be an arrow function so it retains the reference to
   * "this" while also not being anonymous. This allows it to be
   * added as an eventlistener directly while retaining the ability
   * to remove it.
   *
   * @memberof MyComponent
   */
  wheel = (evt: WheelEvent) => {
    evt.preventDefault();

    let scaledVelocity = (!Number.isInteger(evt.deltaY)) ? Math.ceil(evt.deltaY / 100) : Math.ceil(evt.deltaY / 2);
    if (scaledVelocity === -0) scaledVelocity -= 1;
    if (Math.abs(evt.deltaY) > 70) scaledVelocity *= 0.10;

    if (evt.ctrlKey && evt.shiftKey) scaledVelocity = Math.sign(scaledVelocity) * this.maxLines;
    else if (evt.shiftKey) scaledVelocity = Math.sign(scaledVelocity);
    else if (evt.ctrlKey) scaledVelocity *= 20;
    document.getElementById('tooltip').setAttribute('active', 'false')

    if (this.lineNumber + scaledVelocity < 0) this.lineNumber = 0;
    else if (this.lineNumber + scaledVelocity > Math.floor(this.editController.length / this.bytesPerLine) - 1) this.lineNumber = Math.floor(this.editController.length / this.bytesPerLine) - 1;
    else this.lineNumber += scaledVelocity;
  }

  handleRegionKeyDown = (evt: KeyboardEvent) => {
    evt.preventDefault();

    console.log(evt.target);
  }

  render() {
    let out;
    if (this.displayAsChunks) out = this.showChunks()
    else  out = this.showHex()

    return (
      <div class="fudgedit-container">
        {out}
      </div>
    )
  }

  _toggleScrollListener(evt: MouseEvent) {
    if (evt.type === "mouseenter") {
      (evt.target as HTMLElement).addEventListener("wheel", this.wheel, {passive: false});
    }
    else {
      (evt.target as HTMLElement).removeEventListener("wheel", this.wheel, false);
    }
  }
}

