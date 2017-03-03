import React from 'react';
// eslint-disable-next-line no-unused-vars
import { default as DataSelector } from './DataSelector';
import { shallow } from 'enzyme';
import { push as Menu } from 'react-burger-menu';

const emptyFunc = () => {
  // This is intentional
};
const emptyObj = {
  // This is intentional
};
describe('(Component) DataSelector', () => {
  it('Renders a React Burger Menu', () => {
    const _component = shallow(<DataSelector adagucProperties={emptyObj} menuItems={emptyObj} dispatch={emptyFunc} />);
    expect(_component.type()).to.eql(Menu);
  });
});