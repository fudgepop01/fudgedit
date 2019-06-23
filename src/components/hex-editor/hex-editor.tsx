import { Component, State, Prop, Method, Event, EventEmitter } from '@stencil/core';
import { EditController } from './editController';
import { IRegion } from './interfaces';

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
   * the number of bytes between separators
   *
   * @type {number}
   * @memberof HexEditor
   */
  @Prop() bytesPerGroup: number = 4;

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
    this.file = new Uint8Array(32);
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
    this.lineNumber = newLineNumber;
    this.hexLineChanged.emit(newLineNumber);
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

  // !SECTION

  // LOCAL METHODS

  /**
   * builds the elements responsible for the hex view
   */
  buildHexView() {
    const { lineNumber, maxLines, bytesPerLine, bytesPerGroup, /* bytesUntilForcedLine, */ asciiInline } = this;
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
    for (const [lineNum, line] of lines.entries()) {
      // setup variables
      const base = start + lineNum * bytesPerLine;
      const charLines = [];
      const hexLines = [];
      let ascii = '•';
      let selected = false;

      if (line.length === 0) break;

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
        if (position % bytesPerGroup === bytesPerGroup - 1) classList.push('padByte');
        if (this.cursor === base + position) {
          classList.push('cursor');
          selected = true;
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
        <div class={'hexLine' + (selected ? ' selected' : '')}>{hexLines}</div>
      ));

      charViews.push((
        <div class={'charLine' + (selected ? ' selected' : '')}>{charLines}</div>
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
      lineLabels.push(<div class="lineLabel" style={{pointerEvents: 'none'}}>{'0x' + (start + i * bytesPerLine).toString(16).padStart(8, ' ')}</div>)
    }

    // regions

    const regionMarkers = [];

    const buildRegion = (region: IRegion, depth = 0, index?: number) => {
      if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) return;

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

        if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) {
          if (region.subRegions && depth + 1 !== this.regionDepth) {
            for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
          }
          return;
        };

        const offset = Math.floor(region.start / this.bytesPerLine) - lineNumber;

        const getColor = {
          0: ['#88F', '#BBF'],
          1: ['#F88', '#FBB'],
          2: ['#8D8', '#BDB']
        }

        regionMarkers.push((
          <polygon
          onmousemove={`
            if (window.canUpdateMousemove === undefined) {
              window.canUpdateMousemove = true;
            }
            if (window.canUpdateMousemove) {
              window.canUpdateMousemove = false;
              document.documentElement.style.setProperty('--mouse-x', event.clientX);
              document.documentElement.style.setProperty('--mouse-y', event.clientY);
              document.getElementById('tooltip').setAttribute('active', true)
              document.getElementById('tooltip').setAttribute('complex', '${JSON.stringify({...region, subRegions: region.subRegions ? region.subRegions.map(sr => sr.name) : null})}');

              setTimeout(() => {window.canUpdateMousemove = true}, 50);
            }
          `}
          onmouseleave={`document.getElementById('tooltip').setAttribute('active', false)`}
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
      regionMarkers: <svg viewbox={`0 0 ${this.bytesPerLine * this.regionScaleWidth} ${this.maxLines * this.regionScaleHeight}`} width={`${this.bytesPerLine * this.regionScaleWidth}`} height={`${this.maxLines * this.regionScaleHeight}`}>{regionMarkers}</svg>
    }
  }

  edit(evt: KeyboardEvent) {
    if (this.editType === 'readonly') return;
    const editController = this.editController;
    if (!editController.inProgress) editController.initEdit(this.cursor, this.editType);
    editController.buildEdit(evt)
  }

  /**
   * displays the full hexidecimal view
   */
  showHex() {
    const { lineViews, charViews, lineLabels, regionMarkers } = this.buildHexView();

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

      </div>
    );
  }

  /**
   * gets the exact position of
   * @param evt the mousedown event
   */
  beginSelection(evt: any) {
    this.tempSelection =
      this.lineNumber * this.bytesPerLine +
      [...evt.composedPath()[2].children].indexOf(evt.composedPath()[1]) * this.bytesPerLine +
      [...evt.composedPath()[1].children].indexOf(evt.composedPath()[0]);
  }

  endSelection(evt: any) {
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

    if (this.editController.inProgress) {
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
      <div class="container">
        {this.showHex()}
      </div>
    )
  }

  _toggleScrollListener(evt: MouseEvent) {
    if (evt.type === "mouseenter") (evt.target as HTMLElement).addEventListener("wheel", this.scroll, {passive: false});
    else (evt.target as HTMLElement).removeEventListener("wheel", this.scroll, false);
  }
}

