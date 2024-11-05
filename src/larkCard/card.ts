import { CardElement } from "./element";
import { Header } from "./title";

export class LarkCard {
  header: Header;
  elements: CardElement[];

  constructor(header: Header) {
    this.header = header;
    this.elements = [];
  }

  addElements(...elements: CardElement[]): LarkCard {
    this.elements.push(...elements);
    return this;
  }
}
