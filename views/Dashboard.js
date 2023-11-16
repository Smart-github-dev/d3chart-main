import AbstractView from './AbstractView.js'

export default class extends AbstractView {
  constructor () {
    super()
    this.setTitle('Dashboard')
  }

  async getHtml () {

    return `
      <d3-tree-dashboard></d3-tree-dashboard>
    `;
  }
}
