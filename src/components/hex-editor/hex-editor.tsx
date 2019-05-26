import { Component, State, Prop } from '@stencil/core';
import { editController } from './editController';


interface IRegion {
  start: number;
  end: number;
  name?: string;
  description?: string;
  color?: string;
  subRegions?: IRegion[];
}

@Component({
  tag: 'hex-editor',
  styleUrl: 'hex-editor.css',
  shadow: false
})
export class HexEditor {

  editController: editController;

  @Prop() maxLines: number = 30;
  @Prop() bytesPerLine: number = 16;
  @Prop() bytesUntilForcedLine: number = 0;
  @Prop() asciiInline: boolean = false;
  @Prop() bytesPerGroup: number = 4;
  @Prop() regions: IRegion[] = [{
    start: 42,
    end: 205
  }, {
    start: 250,
    end: 369
  }];

  // what is initially seen when a file is uploaded
  @State() fileMetadata: File;
  // the loaded file
  @State() file: Uint8Array;
  // keeps track of which line is displayed
  @State() lineNumber: number = 0;

  // stores position of mousedown event
  tempSelection: number;
  // keeps track of selected portion of hex/ascii
  @State() selection: {start: number, end: number};
  // keeps track of where exactly the cursor is
  @State() cursor: number;

  /**
   * accepts and reads the file, storing the result in
   * the file variable
   * @param event the event
   */
  acceptFile(event: Event) {
    const target = event.target as HTMLInputElement;
    this.fileMetadata = target.files[0];

    const reader = new FileReader();
    reader.readAsArrayBuffer(target.files[0]);
    reader.onload = (event) => {
      this.file = new Uint8Array((event.target as any).result);
      this.editController = new editController(this);
    }
  }

  /**
   * TODO: make this prettier
   * displays the file upload button
   */
  showSelector() {
    return (
      <div class="select">
        <label htmlFor="file-uploader">select a file to upload: </label>
        <input type="file" id="file-uploader" onChange={(evt) => this.acceptFile(evt)} />
      </div>
    );
  }

  /**
   * displays the progress of the file upload
   */
  showLoading() {
    return (
      <div class="loading">
        <div id="MEASURE" class="hex" style={{position: 'absolute', visibility: 'hidden', padding: '0 5px'}}>AB</div>
        <p>loading...</p>
      </div>
    );
  }

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
      lineViews.push(<div class="hexLine"><span>-</span></div>);
      charViews.push(<div class="charLine"><span>-</span></div>);
    }

    // line number builder
    const lineLabels = [];
    for (let i = 0; i < maxLines; i++) {
      lineLabels.push(<div class="lineLabel">{'0x' + (start + i * bytesPerLine).toString(16).padStart(8, ' ')}</div>)
    }

    // regions
    const scaleWidth = document.getElementById('MEASURE').clientWidth;
    const scaleHeight = document.getElementById('MEASURE').clientHeight;

    const regionMarkers = [];
    for (const region of this.regions) {

      const s = region.start % this.bytesPerLine;
      const l = Math.floor((region.end - region.start) / this.bytesPerLine);
      const e = region.end % this.bytesPerLine;

      if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) continue;

      const offset = (Math.floor(region.start / this.bytesPerLine) - lineNumber) * scaleHeight;

      regionMarkers.push((
        <polygon points={`
          0,${scaleHeight + offset}
          ${s * scaleWidth},${scaleHeight + offset}
          ${s * scaleWidth},${offset}
          ${this.bytesPerLine * scaleWidth},${offset}
          ${this.bytesPerLine * scaleWidth},${l * scaleHeight + offset}
          ${e * scaleWidth},${l * scaleHeight + offset}
          ${e * scaleWidth},${(l+1) * scaleHeight + offset}
          0,${(l+1)*scaleHeight + offset}
          `} fill="#7F7" stroke="none"/>
      ))
    }

    return {
      lineViews,
      charViews,
      lineLabels,
      regionMarkers: <svg viewbox={`0 0 ${this.bytesPerLine * scaleWidth} ${this.maxLines * scaleHeight}`} style={{width: this.bytesPerLine * scaleWidth, height: this.maxLines * scaleHeight}}>{regionMarkers}</svg>
    }
  }

  edit(evt: KeyboardEvent) {
    const editController = this.editController;
    if (!editController.inProgress) editController.initEdit(this.cursor, "overwrite");
    editController.buildEdit(evt)
  }

  // moveCursor(location: number, offset: "relative" | "absolute") {
  //   if (offset === "relative") this.cursor += location;
  //   else this.cursor = location;
  // }

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
        <div id="MEASURE" style={{position: 'absolute', visibility: 'hidden', padding: '0 5px'}}>AB</div>
        <div class="lineLabels">
          {lineLabels}
        </div>
        <div class="hexView">
          <div class="highlight" style={{position: 'absolute', top: '0'}}>
            {regionMarkers}
          </div>
          <div class="main">
            {lineViews}
          </div>
        </div>
        <div class="asciiView">
          {charViews}
        </div>
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
      [...evt.path[2].children].indexOf(evt.path[1]) * this.bytesPerLine +
      [...evt.path[1].children].indexOf(evt.path[0]);
  }

  endSelection(evt: any) {
    const chosen =
      this.lineNumber * this.bytesPerLine +
      [...evt.path[2].children].indexOf(evt.path[1]) * this.bytesPerLine +
      [...evt.path[1].children].indexOf(evt.path[0]);

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

    if (this.editController.inProgress) this.editController.commit();
  }

  /**
   * This must be an arrow function so it retains the reference to
   * "this" while also not being anonymous. This allows it to be
   * added as an eventlistener directly while retaining the ability
   * to remove it.
   *
   * @memberof MyComponent
   */
  scroll = (evt: MouseWheelEvent) => {
    let scaledVelocity = Math.ceil(evt.deltaY / 2);
    if (scaledVelocity === -0) scaledVelocity -= 1;

    if (this.lineNumber + scaledVelocity < 0) this.lineNumber = 0;
    else if (this.lineNumber + scaledVelocity > Math.floor(this.editController.length / this.bytesPerLine) - 1) this.lineNumber = Math.floor(this.editController.length / this.bytesPerLine) - 1;
    else this.lineNumber += scaledVelocity;
  }

  render() {
    return (
      <div class="container">
        {!this.fileMetadata
            ? this.showSelector()
            : !this.file
              ? this.showLoading()
              : this.showHex()}
      </div>
    )
  }

  _toggleScrollListener(evt: MouseEvent) {
    if (evt.type === "mouseenter") (evt.target as HTMLElement).addEventListener("wheel", this.scroll, {passive: true});
    else (evt.target as HTMLElement).removeEventListener("wheel", this.scroll, false);
  }
}

