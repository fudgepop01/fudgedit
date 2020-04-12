import { Component, State, Prop, Method, Event, EventEmitter, h, forceUpdate } from '@stencil/core';
import { EditController } from './editController';
import { IRegion } from './interfaces';
import { floatToBin } from './floatConverter';

@Component({
  tag: 'fudge-hex-editor',
  styleUrl: 'hex-editor.css',
  shadow: false
})
export class HexEditor {
  // SECTION OWN PROPERTIES

  editController: EditController;
  regionScaleWidth: number;
  regionScaleHeight: number;
  canUpdateMouseMove: boolean;

  // !SECTION

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
  @State() lineNumber: number = 0;

  // stores position of mousedown event
  tempSelection: number;
  // keeps track of selected portion of hex/ascii
  @State() selection: {start: number, end: number};
  // keeps track of where exactly the cursor is
  @State() cursor: number;
  // keeps track of what part of the editor was last clicked
  @State() asciiMode: boolean;

  // the type of search to be executed
  @State() searchType: 'ascii' | 'byte' | 'integer' | 'float' = 'ascii';
  // number of bytes the search should have (used when integer or float)
  @State() searchByteCount: 1 | 2 | 4 | 8 = 1;
  // endianness of the search
  @State() searchEndian: 'big' | 'little' = 'big';
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
   * currently does nothing
   * it WOULD force a line break every X bytes
   * @type {number}
   * @memberof HexEditor
   * @deprecated
   */
  @Prop() bytesUntilForcedLine: number = 0;

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
  @Prop() chunksPerGroup: number = 4;

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
  @Prop() mode: "region" | "edit" | "noregion" = "edit";

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
  @Prop() editType: "insert" | "overwrite" | "readonly" = "overwrite";

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
  async setCursorPosition(newCursorPosition: number) {
    this.cursor = newCursorPosition;
  }

  /**
   * sets the new selection bounds.
   * @param {{start?: number, end?: number}} newSelection
   * @memberof HexEditor
   */
  @Method()
  async setSelection(newSelection: {start?: number, end?: number}) {
    this.selection = {...this.selection, ...newSelection};
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
   * @param {typeof HexEditor.prototype.searchType} searchType
   * @param {[number, number]} range
   * @param {(1 | 2 | 4 | 8)} [searchByteCount]
   * @param {('big' | 'little')} [searchEndian]
   * @memberof HexEditor
   */
  @Method()
  async executeSearch(
    text: string,
    searchType: typeof HexEditor.prototype.searchType,
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
    const { lineNumber, maxLines, bytesPerLine, chunksPerGroup, /* bytesUntilForcedLine, */ asciiInline } = this;
    const start = lineNumber * bytesPerLine;

    const chunkData = this.editController.render(start, maxLines * bytesPerLine);
    const chunk = chunkData.out;
    const addedRanges = chunkData.meta.added;

    const lines: Uint8Array[] = [];
    for (let i = 0; i < maxLines; i++) {
      lines.push(chunk.subarray(i * bytesPerLine, (i+1) * bytesPerLine));
    }

    const lineViews = [];
    const charViews = [];
    let selectedLine = -1;
    for (const [lineNum, line] of lines.entries()) {
      if (line.length === 0) break;

      // setup variables
      const base = start + lineNum * bytesPerLine;
      const charLines = [];
      const hexLines = [];
      let ascii = '•';

      // sets up everything else.
      for (const [position, val] of [...line.values()].entries()) {
        let out: string;
        if (/\w|[!@#$%^&*()_+=\]\\:;"'>.<,/?]/.test(String.fromCharCode(val))) {
          ascii = String.fromCharCode(val);
        } else { ascii = '•'; }

        if (asciiInline && /\w/.test(ascii)) { out = "." + ascii; }
        else { out = val.toString(16).toUpperCase().padStart(2, '0'); }

        // classes
        const classList = [];
        if (out.startsWith('.')) classList.push('ASCII');
        if (position % chunksPerGroup === chunksPerGroup - 1) classList.push('padByte');
        if (this.cursor === base + position) {
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

        charLines.push(<span class={classList.join(' ')}>{ascii}</span>);
        hexLines.push(<span class={classList.join(' ')}>{out}</span>);
      }

      lineViews.push((
        <div class={'hexLine' + (selectedLine === lineNum ? ' selected' : '')}>{hexLines}</div>
      ));

      charViews.push((
        <div class={'charLine' + (selectedLine === lineNum ? ' selected' : '')}>{charLines}</div>
      ))

    }

    // fill extra space
    while (lineViews.length < maxLines) {
      lineViews.push(<div class="hexLine" style={{pointerEvents: 'none'}}><span>-</span></div>);
      charViews.push(<div class="charLine" style={{pointerEvents: 'none'}}><span>-</span></div>);
    }

    // line number builder
    const lineLabels = [];
    for (let i = 0; i < maxLines; i++) {
      lineLabels.push(<div class={'lineLabel' + (selectedLine === i ? ' selected' : '')} style={{pointerEvents: 'none'}}>{'0x' + (start + i * bytesPerLine).toString(16).padStart(8, ' ')}</div>)
    }

    // regions

    const regionMarkers = [];

    const buildRegion = (region: IRegion, depth = 0, index?: number) => {
      if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) {
        if (region.subRegions && depth + 1 !== this.regionDepth) {
          for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
        }
        return;
      };

      if (depth === this.regionDepth) return;

      // else {
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

        regionMarkers.push((
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
            0,${(1 + offset) * this.regionScaleHeight}
            ${s * this.regionScaleWidth},${(1 + offset) * this.regionScaleHeight}
            ${s * this.regionScaleWidth},${offset * this.regionScaleHeight}
            ${this.bytesPerLine * this.regionScaleWidth},${offset * this.regionScaleHeight}
            ${this.bytesPerLine * this.regionScaleWidth},${(l + offset) * this.regionScaleHeight}
            ${e * this.regionScaleWidth},${(l + offset) * this.regionScaleHeight}
            ${e * this.regionScaleWidth},${(l + offset + 1) * this.regionScaleHeight}
            0,${(l+1 + offset) * this.regionScaleHeight}
            `} fill={region.color || getColor[depth % 3][index % 2]} stroke="none"/>
        ))
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
    return {
      lineViews,
      charViews,
      lineLabels,
      regionMarkers: <svg viewBox={`0 0 ${this.bytesPerLine * this.regionScaleWidth} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * this.regionScaleWidth}`} height={`${this.maxLines * this.regionScaleHeight}`}>{regionMarkers}</svg>
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
    if (this.editType === 'readonly') return;
    evt.preventDefault();
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
      this.searchActive = !this.searchActive;
      forceUpdate(this);
    } else {
      this.editController.buildEdit(evt);
    }
  }

  /**
   * turns the search input from the type into an array of numbers
   * that represent its binary equivalent in the format specified
   *
   * @param {string} text
   * @param {typeof HexEditor.prototype.searchType} searchType
   * @param {(1 | 2 | 4 | 8)} [searchByteCount]
   * @param {('big' | 'little')} [searchEndian]
   * @returns {number[]}
   * @memberof HexEditor
   */
  formatSearch(
    text: string,
    searchType: typeof HexEditor.prototype.searchType,
    searchByteCount?: 1 | 2 | 4 | 8,
    searchEndian?: 'big' | 'little'
  ): number[] {
    if (text.length === 0) throw new Error('LEN0: there needs to be something to search for...');
    switch(searchType) {
      case 'integer':
        const max = parseInt('0x' + new Array(searchByteCount + 1).join('FF'), 16);
        let v = parseInt(text);
        if (Math.abs(v) > max) {
          v = max * Math.sign(v);
        }
        const out = v.toString(16).padStart(2 * searchByteCount, '0').match(/.{2}/g).map(v => parseInt(v, 16));
        if (searchEndian === 'little') out.reverse();
        return out;
      case 'float':
        console.log(parseFloat(text))
        return floatToBin(parseFloat(text), searchByteCount, searchEndian)
      case 'byte':
        if (/[^0-9a-f ,|;]/ig.test(text)) throw new Error('UC: Unexpected Character (must be exclusively 0-9 and a-f)')
        else {
          return text.replace(/[ ,|;]/ig, '').match(/.{2}/g).map(v => parseInt(v, 16));
        }
      case 'ascii':
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
    const { lineViews, charViews, lineLabels, regionMarkers } = this.buildHexView();

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
        this.setSelection({start: v, end: v + ((['integer', 'float'].includes(this.searchType)) ? this.searchByteCount : this.searchInput.length) - 1 })
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
        <div class="hexView">
          <div class="highlight" style={{position: 'absolute', top: '0', display: this.mode === 'noregion' ? 'none' : 'block', zIndex: this.mode === 'region' ? '3' : '0'}}>
            {regionMarkers}
          </div>
          <div class="main">
            {lineViews}
          </div>
        </div>
        {this.displayAscii ?
          <div class="asciiView">
            {charViews}
          </div>
          : null}
        {this.searchActive ?
          <div class="find">
            search:
            <input type="text" onChange={(evt) => this.searchInput = (evt.target as HTMLInputElement).value} />
            <select onChange={(evt) => this.searchType = (evt.target as HTMLSelectElement).value as any}>
              <option value="ascii">ASCII string</option>
              <option value="byte">bytes</option>
              <option value="integer">integer</option>
              <option value="float">float</option>
            </select>
            {(['integer', 'float'].includes(this.searchType)) ? [
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
   * gets the exact position of
   * @param evt the mousedown event
   */
  beginSelection(evt: any) {
    if ((evt.target as HTMLElement).id === 'HEX-SCROLLBAR') return;
    this.tempSelection =
      this.lineNumber * this.bytesPerLine +
      [...evt.composedPath()[2].children].indexOf(evt.composedPath()[1]) * this.bytesPerLine +
      [...evt.composedPath()[1].children].indexOf(evt.composedPath()[0]);
  }

  endSelection(evt: any) {
    const parentClassName = (evt.target as HTMLElement).parentElement.className;
    if (!(parentClassName.includes('charLine') || parentClassName.includes('hexLine'))) {
      return;
    }
    this.asciiMode = parentClassName.includes('charLine');

    const chosen =
      this.lineNumber * this.bytesPerLine +
      [...evt.composedPath()[2].children].indexOf(evt.composedPath()[1]) * this.bytesPerLine +
      [...evt.composedPath()[1].children].indexOf(evt.composedPath()[0]);

    if (this.tempSelection > chosen) {
      this.selection = {
        start: chosen,
        end: this.tempSelection,
      }
    } else {
      this.selection = {
        start: this.tempSelection,
        end: chosen,
      }
    }

    this.tempSelection = null;
    this.cursor = chosen;

    this.hexCursorChanged.emit(this.cursor);
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
  scroll = (evt: WheelEvent) => {
    evt.preventDefault();

    let scaledVelocity = (!Number.isInteger(evt.deltaY)) ? Math.ceil(evt.deltaY / 100) : Math.ceil(evt.deltaY / 2);
    if (scaledVelocity === -0) scaledVelocity -= 1;

    if (this.lineNumber + scaledVelocity < 0) this.lineNumber = 0;
    else if (this.lineNumber + scaledVelocity > Math.floor(this.editController.length / this.bytesPerLine) - 1) this.lineNumber = Math.floor(this.editController.length / this.bytesPerLine) - 1;
    else this.lineNumber += scaledVelocity;
  }

  render() {
    return (
      <div class="fudgedit-container">
        {this.showHex()}
      </div>
    )
  }

  _toggleScrollListener(evt: MouseEvent) {
    if (evt.type === "mouseenter") (evt.target as HTMLElement).addEventListener("wheel", this.scroll, {passive: false});
    else (evt.target as HTMLElement).removeEventListener("wheel", this.scroll, false);
  }
}

