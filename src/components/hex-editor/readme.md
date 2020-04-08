# hex-editor



<!-- Auto Generated Below -->


## Properties

| Property               | Attribute                 | Description                                                                                                                                                                                                                                                    | Type                                    | Default       |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------- |
| `asciiInline`          | `ascii-inline`            | weather or not to replace typical ASCII values with their ASCII value representation ( ex: 0x61 ==> ".a" )                                                                                                                                                     | `boolean`                               | `false`       |
| `bytesPerLine`         | `bytes-per-line`          | the number of bytes to display per line                                                                                                                                                                                                                        | `number`                                | `16`          |
| `bytesUntilForcedLine` | `bytes-until-forced-line` | <span style="color:red">**[DEPRECATED]**</span> <br/><br/>currently does nothing it WOULD force a line break every X bytes                                                                                                                                     | `number`                                | `0`           |
| `chunksPerGroup`       | `chunks-per-group`        | the number of chunks between separators                                                                                                                                                                                                                        | `number`                                | `4`           |
| `displayAscii`         | `display-ascii`           | weather or not to display ASCII on the side                                                                                                                                                                                                                    | `boolean`                               | `true`        |
| `editType`             | `edit-type`               | the mode of data entry: insert:     inserts data between bytes overwrite:     overwrites the currently selected byte readonly:     no edits are possible                                                                                                       | `"insert" \| "overwrite" \| "readonly"` | `"overwrite"` |
| `maxLines`             | `max-lines`               | the number of lines to display at once                                                                                                                                                                                                                         | `number`                                | `30`          |
| `mode`                 | `mode`                    | the mode of operation: region:     used to highlight different regions. Hovering over     a region displays a tooltip edit:     regions are displayed in the background, allowing     the user to edit directly noregion:     regions are not displayed at all | `"edit" \| "noregion" \| "region"`      | `"edit"`      |
| `regionDepth`          | `region-depth`            | the number of regions to traverse                                                                                                                                                                                                                              | `number`                                | `2`           |
| `regions`              | --                        | the region data. Data will be displayed in the tooltip if mode is set to "region"                                                                                                                                                                              | `IRegion[]`                             | `[]`          |


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



### `setCursorPosition(newCursorPosition: number) => Promise<void>`

sets the new cursor position

#### Returns

Type: `Promise<void>`



### `setLineNumber(newLineNumber: number) => Promise<void>`

sets the line number

#### Returns

Type: `Promise<void>`



### `setSelection(newSelection: { start?: number; end?: number; }) => Promise<void>`

sets the new selection bounds.

#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
