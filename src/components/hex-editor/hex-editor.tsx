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

  @Prop({attr: 'maxlines'}) maxLines: number = 30;
  @Prop({attr: 'bytesperline'}) bytesPerLine: number = 16;
  @Prop() bytesUntilForcedLine: number = 0;
  @Prop({attr: 'asciiinline'}) asciiInline: boolean = false;
  @Prop({attr: 'bytespergroup'}) bytesPerGroup: number = 4;
  @Prop({attr: 'mode'}) mode: "region" | "edit" | "noregion" = "region";
  @Prop({attr: 'edittype'}) editType: "insert" | "overwrite" | "readonly" = "overwrite";
  @Prop({attr: 'regiondepth'}) regionDepth: number = 2;

  @Prop() regions: IRegion[] = [{
    start: 0x0,
    end: 0x40,
    name: 'start',
    description: 'the start of the file. Hopefully this works',
    subRegions: [{
      start: 0x0,
      end: 0x20,
      subRegions: [{
        start: 0x0,
        end: 0x8
      }, {
        start: 0x10,
        end: 0x16
      }]
    }, {
      start: 0x20,
      end: 0x40
    }]
  },
  {
    start: 0x40,
    end: 0x69
  },
  {
    start: 0x269,
    end: 0x369
  },
  {
    start: 0x369,
    end: 0x400
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

    const buildRegion = (region: IRegion, depth = 0, index?: number) => {
      if (depth === 0) {
        if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) return;
      }

      if (depth === this.regionDepth) return;
      // if regions don't work right in the future then the if condition below is the reason why
      else if (region.subRegions && depth + 1 !== this.regionDepth) {
        for (const [i, r] of region.subRegions.entries()) buildRegion(r, depth + 1, i);
      }
      else {
        // start / end offsets
        const s = region.start % this.bytesPerLine;
        const e = region.end % this.bytesPerLine;

        // l is the "height" of the region. It was a bit confusing, so allow me to explain:
        // instead of only taking into account the start and end of the region's offsets,
        // what we ACTUALLY want is the start and end while taking into account the offset
        // provided by 's'
        const l = Math.floor((region.end - region.start + s) / this.bytesPerLine);

        if (region.end < start || region.start > start + this.maxLines * this.bytesPerLine) return;

        const offset = Math.floor(region.start / this.bytesPerLine) - lineNumber;

        const getColor = {
          0: ['#77F', '#BBF'],
          1: ['#F77', '#FBB'],
          2: ['#7D7', '#BDB']
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
            0,${(1 + offset) * scaleHeight}
            ${s * scaleWidth},${(1 + offset) * scaleHeight}
            ${s * scaleWidth},${offset * scaleHeight}
            ${this.bytesPerLine * scaleWidth},${offset * scaleHeight}
            ${this.bytesPerLine * scaleWidth},${(l + offset) * scaleHeight}
            ${e * scaleWidth},${(l + offset) * scaleHeight}
            ${e * scaleWidth},${(l + offset + 1) * scaleHeight}
            0,${(l+1 + offset) * scaleHeight}
            `} fill={region.color || getColor[depth % 3][index % 2]} stroke="none"/>
        ))
      }
    }

    for (const [i, region] of this.regions.entries()) {
      buildRegion(region, 0, i);
    }
    // style={{width: this.bytesPerLine * scaleWidth, height: this.maxLines * scaleHeight}}
    return {
      lineViews,
      charViews,
      lineLabels,
      regionMarkers: <svg viewbox={`0 0 ${this.bytesPerLine * scaleWidth} ${this.maxLines * scaleHeight}`} width={`${this.bytesPerLine * scaleWidth}`} height={`${this.maxLines * scaleHeight}`}>{regionMarkers}</svg>
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
        <div id="MEASURE" style={{position: 'absolute', visibility: 'hidden', padding: '0 5px'}}>AB</div>
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
    console.log(evt.composedPath());
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
  scroll = (evt: WheelEvent) => {
    evt.preventDefault();
    console.log(evt.deltaY);

    let scaledVelocity = (evt.deltaY % 1 !== 0) ? Math.ceil(evt.deltaY / 100) : Math.ceil(evt.deltaY / 2);
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
    if (evt.type === "mouseenter") (evt.target as HTMLElement).addEventListener("wheel", this.scroll, {passive: false});
    else (evt.target as HTMLElement).removeEventListener("wheel", this.scroll, false);
  }
}

