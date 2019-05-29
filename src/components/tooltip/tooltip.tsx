import { Component, Prop } from "@stencil/core";

@Component({
  tag: 'fudge-tooltip',
  styleUrl: 'tooltip.css',
  shadow: false,
})
export class Tooltip {

  @Prop({attr: 'active'}) active: boolean = false;
  @Prop({attr: 'complex'}) data: {[key: string]: string} | string;
  @Prop({attr: 'simple'}) simpleText: string;

  render() {
    if (!this.active) return;
    const out: any[] = [];

    if (this.data) {
      let data = (typeof this.data === 'string') ? JSON.parse(this.data) : this.data;
      for (const [key, value] of Object.entries(data)) {
        if (value !== null) {
          out.push(<span>{key}: {value}</span>);
          out.push(<br/>);
        }
      }
    } else if (this.simpleText) {
      out.push(<span>{this.simpleText}</span>);
    } else {
      out.push(<span>placeholder</span>)
    }

    return out
  }
}
