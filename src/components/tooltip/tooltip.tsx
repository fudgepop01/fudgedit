import { Component, Prop, h } from "@stencil/core";

@Component({
  tag: 'fudge-hex-tooltip',
  styleUrl: 'tooltip.css',
  shadow: false,
})
export class Tooltip {

  @Prop({attribute: 'active'}) active: boolean = false;
  @Prop({attribute: 'complex'}) data: {[key: string]: string} | string;
  @Prop({attribute: 'simple'}) simpleText: string;

  render() {
    if (!this.active) return;
    const out: any[] = [];

    if (this.data) {
      let data = (typeof this.data === 'string') ? JSON.parse(this.data) : this.data;
      if (data.name) out.push(<span>{`name: ${data.name}`}</span>,<br/>);
      out.push(<span>{`size: ${data.end - data.start} [0x${data.start.toString(16)} - 0x${data.end.toString(16)}]`}</span>,<br/>);

      for (const [key, value] of Object.entries(data)) {
        if (['name', 'subRegions', 'start', 'end'].includes(key)) continue;
        if (value !== null) {
          out.push(<span>{key}: {value}</span>,<br/>);
        }
      }
    } else if (this.simpleText) {
      out.push(<span>{this.simpleText}</span>);
    } else {
      out.push(<span>placeholder</span>)
    }

    return out;
  }
}
