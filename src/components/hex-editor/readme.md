# hex-editor



<!-- Auto Generated Below -->


## Properties

| Property               | Attribute                 | Description                                                                                                                                                                                                                                                    | Type                                    | Default       |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------- |
| `asciiInline`          | `ascii-inline`            | weather or not to replace typical ASCII values with their ASCII value representation ( ex: 0x61 ==> ".a" )                                                                                                                                                     | `boolean`                               | `false`       |
| `bytesPerGroup`        | `bytes-per-group`         | the number of bytes between separators                                                                                                                                                                                                                         | `number`                                | `4`           |
| `bytesPerLine`         | `bytes-per-line`          | the number of bytes to display per line                                                                                                                                                                                                                        | `number`                                | `16`          |
| `bytesUntilForcedLine` | `bytes-until-forced-line` | currently does nothing it WOULD force a line break every X bytes                                                                                                                                                                                               | `number`                                | `0`           |
| `displayAscii`         | `display-ascii`           | weather or not to display ASCII on the side                                                                                                                                                                                                                    | `boolean`                               | `true`        |
| `editType`             | `edit-type`               | the mode of data entry: insert:     inserts data between bytes overwrite:     overwrites the currently selected byte readonly:     no edits are possible                                                                                                       | `"insert" \| "overwrite" \| "readonly"` | `"overwrite"` |
| `maxLines`             | `max-lines`               | the number of lines to display at once                                                                                                                                                                                                                         | `number`                                | `30`          |
| `mode`                 | `mode`                    | the mode of operation: region:     used to highlight different regions. Hovering over     a region displays a tooltip edit:     regions are displayed in the background, allowing     the user to edit directly noregion:     regions are not displayed at all | `"edit" \| "noregion" \| "region"`      | `"edit"`      |
| `regionDepth`          | `region-depth`            | the number of regions to traverse                                                                                                                                                                                                                              | `number`                                | `2`           |
| `regions`              | --                        | the region data. Data will be displayed in the tooltip if mode is set to "region"                                                                                                                                                                              | `IRegion[]`                             | `[]`          |


## Events

| Event                 | Description                                    | Type                |
| --------------------- | ---------------------------------------------- | ------------------- |
| `hexCursorChanged`    | Emitted on the change of the cursor's position | `CustomEvent<void>` |
| `hexDataChanged`      | fired when the file's data changes             | `CustomEvent<void>` |
| `hexLineChanged`      | Emitted when the lineNumber changes            | `CustomEvent<void>` |
| `hexLoaded`           | fired when the component loads                 | `CustomEvent<void>` |
| `hexSelectionChanged` | Emitted when the selection changes             | `CustomEvent<void>` |


## Methods

### `acceptFile(file: File) => Promise<void>`

accepts and reads the given file, storing the result in
the file variable

#### Parameters

| Name   | Type   | Description |
| ------ | ------ | ----------- |
| `file` | `File` |             |

#### Returns

Type: `Promise<void>`



### `saveFile() => Promise<void | Uint8Array>`

returns the edited file

#### Returns

Type: `Promise<void | Uint8Array>`



### `setCursorPosition(newCursorPosition: number) => Promise<void>`

sets the new cursor position

#### Parameters

| Name                | Type     | Description |
| ------------------- | -------- | ----------- |
| `newCursorPosition` | `number` |             |

#### Returns

Type: `Promise<void>`



### `setLineNumber(newLineNumber: number) => Promise<void>`

sets the line number

#### Parameters

| Name            | Type     | Description |
| --------------- | -------- | ----------- |
| `newLineNumber` | `number` |             |

#### Returns

Type: `Promise<void>`



### `setSelection(newSelection: { start?: number; end?: number; }) => Promise<void>`

sets the new selection bounds.

#### Parameters

| Name           | Type                                | Description |
| -------------- | ----------------------------------- | ----------- |
| `newSelection` | `{ start?: number; end?: number; }` |             |

#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
