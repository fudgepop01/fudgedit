# hex-editor



<!-- Auto Generated Below -->


## Properties

| Property          | Attribute           | Description                                                                                                                                                                                                                                                    | Type                                                | Default      |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------ |
| `asciiInline`     | `ascii-inline`      | weather or not to replace typical ASCII values with their ASCII value representation ( ex: 0x61 ==> ".a" )                                                                                                                                                     | `boolean`                                           | `false`      |
| `bitsPerGroup`    | `bits-per-group`    | the number of bits between separators on the bit display                                                                                                                                                                                                       | `number`                                            | `8`          |
| `bytesPerGroup`   | `bytes-per-group`   | the number of chunks between separators                                                                                                                                                                                                                        | `number`                                            | `4`          |
| `bytesPerLine`    | `bytes-per-line`    | the number of bytes to display per line                                                                                                                                                                                                                        | `number`                                            | `16`         |
| `chunks`          | --                  | definitions for each chunk to display when displayAsChunks is enabled                                                                                                                                                                                          | `{ title?: string; start: number; end: number; }[]` | `[]`         |
| `displayAsChunks` | `display-as-chunks` | displays the file as chunks (defined above)                                                                                                                                                                                                                    | `boolean`                                           | `false`      |
| `displayAscii`    | `display-ascii`     | weather or not to display ASCII on the side                                                                                                                                                                                                                    | `boolean`                                           | `true`       |
| `displayBin`      | `display-bin`       | weather or not to display binary                                                                                                                                                                                                                               | `boolean`                                           | `false`      |
| `displayHex`      | `display-hex`       | weather or not to display Hex                                                                                                                                                                                                                                  | `boolean`                                           | `true`       |
| `editType`        | `edit-type`         | the mode of data entry: insert:     inserts data between bytes overwrite:     overwrites the currently selected byte readonly:     no edits are possible                                                                                                       | `"insert" \| "overwrite" \| "readonly"`             | `"readonly"` |
| `maxLines`        | `max-lines`         | the number of lines to display at once                                                                                                                                                                                                                         | `number`                                            | `30`         |
| `mode`            | `mode`              | the mode of operation: region:     used to highlight different regions. Hovering over     a region displays a tooltip edit:     regions are displayed in the background, allowing     the user to edit directly noregion:     regions are not displayed at all | `"noregion" \| "region" \| "select"`                | `"select"`   |
| `regionDepth`     | `region-depth`      | the number of regions to traverse                                                                                                                                                                                                                              | `number`                                            | `2`          |
| `regions`         | --                  | the region data. Data will be displayed in the tooltip if mode is set to "region"                                                                                                                                                                              | `IRegion[]`                                         | `[]`         |


## Events

| Event                 | Description                                    | Type               |
| --------------------- | ---------------------------------------------- | ------------------ |
| `hexCursorChanged`    | Emitted on the change of the cursor's position | `CustomEvent<any>` |
| `hexDataChanged`      | fired when the file's data changes             | `CustomEvent<any>` |
| `hexLineChanged`      | Emitted when the lineNumber changes            | `CustomEvent<any>` |
| `hexLoaded`           | fired when the component loads                 | `CustomEvent<any>` |
| `hexSelectionChanged` | Emitted when the selection changes             | `CustomEvent<any>` |


## Methods

### `acceptFile(file: File) => Promise<void>`

accepts and reads the given file, storing the result in
the file variable

#### Returns

Type: `Promise<void>`



### `executeSearch(text: string, searchType: "ascii" | "byte" | "integer" | "float", range?: [number, number], searchByteCount?: 2 | 1 | 4 | 8, searchEndian?: "big" | "little") => Promise<number[]>`

executes a search in the currently loaded file with the supplied parameters

#### Returns

Type: `Promise<number[]>`



### `getChunk(location: number, length: number) => Promise<{ out: Uint8Array; meta: { added: [number, number][]; }; }>`

fetches a Uint8Array of a given length
at the given location

#### Returns

Type: `Promise<{ out: Uint8Array; meta: { added: [number, number][]; }; }>`



### `getFileMetadata() => Promise<File>`

returns the file's metadata

#### Returns

Type: `Promise<File>`



### `saveFile() => Promise<void | Uint8Array>`

returns the edited file

#### Returns

Type: `Promise<void | Uint8Array>`



### `setCursorPosition(newCursorPosition: number, bit?: number) => Promise<void>`

sets the new cursor position

#### Returns

Type: `Promise<void>`



### `setLineNumber(newLineNumber: number) => Promise<void>`

sets the line number

#### Returns

Type: `Promise<void>`



### `setSelection(newSelection: { start?: number; end?: number; startBit?: number; endBit?: number; }) => Promise<void>`

sets the new selection bounds.

#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
