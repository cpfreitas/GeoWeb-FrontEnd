import React, { Component } from 'react';
import { arrayMove } from 'react-sortable-hoc';
import PropTypes from 'prop-types';
import TimeSchedule from '../TimeSchedule';
import moment from 'moment';
import { Button, Row, Col } from 'reactstrap';
import { createTAFJSONFromInput, setTACColumnInput, removeInputPropsFromTafJSON, cloneObjectAndSkipNullProps } from './FromTacCodeToTafjson';
import TafTable from './TafTable';
import { TAFS_URL } from '../../constants/backend';
import axios from 'axios';

/**
  TafCategory is the component which renders an editable and sortable TAF table.
  The UI is generated from a TAF JSON and it can generate/update TAF JSON from user input

  The component hierarchy is structured as follows:

                                  TACColumn(s) -> BaseForecast -> \
                                                                    --> TafTable -> TafCategory -> Taf
      TACColumn(s) -> ChangeGroup(s) -> SortableChangeGroup(s) -> /

*/
class TafCategory extends Component {
  constructor (props) {
    super(props);
    this.onSortEnd = this.onSortEnd.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onAddRow = this.onAddRow.bind(this);
    this.onDeleteRow = this.onDeleteRow.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.updateTACtoTAFJSONtoTac = this.updateTACtoTAFJSONtoTac.bind(this);
    this.validateTAF = this.validateTAF.bind(this);
    this.saveTaf = this.saveTaf.bind(this);

    let TAFStartHour = moment().utc().hour();
    TAFStartHour = TAFStartHour + 6;
    TAFStartHour = parseInt(TAFStartHour / 6);
    TAFStartHour = TAFStartHour * (6);
    this.state = {
      tafJSON: {
        forecast:{},
        metadata:{
          validityStart: moment().utc().hour(TAFStartHour).add(0, 'hour').format('YYYY-MM-DDTHH:00:00') + 'Z',
          validityEnd: moment().utc().hour(TAFStartHour).add(30, 'hour').format('YYYY-MM-DDTHH:00:00') + 'Z'
        },
        changegroups:[]
      }
    };
  };

  /*
    Event handler which handles change events from all input (TAC) fields.
    - colIndex is the corresponding TACColumn
    - rowIndex -1 means BaseForecast, other values (>= 0) are ChangeGroups
  */
  onChange (event, rowIndex, colIndex) {
    let fieldVal = event.target.value;
    if (fieldVal === undefined || fieldVal === null) fieldVal = '';
    fieldVal = fieldVal.toUpperCase();
    let clonedTafState = cloneObjectAndSkipNullProps(this.state.tafJSON);
    setTACColumnInput(fieldVal, rowIndex, colIndex, rowIndex >= 0 ? clonedTafState.changegroups[rowIndex] : clonedTafState);
    let newTaf = createTAFJSONFromInput(clonedTafState);
    this.setState({
      tafJSON: newTaf
    });
    this.validateTAF(newTaf);
  }

  validateTAF (tafJSON) {
    // Validate typed settings
    let taf = removeInputPropsFromTafJSON(cloneObjectAndSkipNullProps(tafJSON));

    axios({
      method: 'post',
      url: TAFS_URL + '/tafs/verify',
      withCredentials: true,
      data: JSON.stringify(taf),
      headers: { 'Content-Type': 'application/json' }
    }).then(
      response => {
        if (response.data) {
          this.setState({
            validationReport:response.data
          });
        } else {
          this.setState({
            validationReport:null
          });
        }
      }
    ).catch(error => {
      console.log(error);
      this.setState({
        validationReport:{ message: 'Invalid response from TAF verify servlet [/tafs/verify].' }
      });
    });
  }

  saveTaf (tafDATAJSON) {
    axios({
      method: 'post',
      url: TAFS_URL + '/tafs',
      withCredentials: true,
      data: JSON.stringify(tafDATAJSON),
      headers: { 'Content-Type': 'application/json' }
    }).then(src => {
      this.setState({ validationReport:src.data });
      // this.props.updateParent();
    }).catch(error => {
      this.setState({ validationReport:{ message: 'Unable to save: error occured while saving TAF.' } });
      try {
        console.log('Error occured', error.response.data);
        if (error.response.data.message) {
          this.setState({ validationReport:{ message: error.response.data.message } });
        }
      } catch (e) {
        console.log(e);
        this.setState({ validationReport:{ message: JSON.stringify(error.response) } });
      }
    });
  }

  /*
    Function to update whole UI, roundtrip from TAC->JSON->TAC
    - First TAC fields are converted to TAF json object.
    - Second, TAC fields are rendered from TAF json (by setState)
  */
  updateTACtoTAFJSONtoTac () {
    /* First from form inputs to TAF JSON */
    let newTAFJSON = removeInputPropsFromTafJSON(createTAFJSONFromInput(this.state.tafJSON));
    if (!newTAFJSON) {
      console.log('error newTAFJSON is null');
      return;
    }
    /* Then update state and inputs will be rendered from JSON */
    this.setState({
      tafJSON: newTAFJSON
    });
    return newTAFJSON;
  }

  /*
    Event handler which handles keyUp events from input fields. E.g. arrow keys, Enter key, Esc key, etc...
  */
  onKeyUp (event, row, col, inputValue) {
    if (event.keyCode === 13) {
      this.onAddRow();
    }
    if (event.keyCode === 27) {
      this.updateTACtoTAFJSONtoTac();
      this.validateTAF(this.state.tafJSON);
    }
    if (this.state.tafJSON.changegroups.length > 0) {
      if (event.keyCode === 38) { // KEY ARROW UP
        if (row === 0) { // Up from changegroup to baseforecast
          this.refs['taftable'].refs['baseforecast'].refs['column_' + col].refs['inputfield'].focus();
        } else if (row > 0) { // Up from changegroup to changegroup
          this.refs['taftable'].refs['changegroup_' + (row - 1)].refs['sortablechangegroup'].refs['column_' + col].refs['inputfield'].focus();
        }
      }
      if (event.keyCode === 40) { // KEY ARROW DOWN
        if (row === -1) { // Down from baseforecast to changegroup
          this.refs['taftable'].refs['changegroup_' + (row + 1)].refs['sortablechangegroup'].refs['column_' + col].refs['inputfield'].focus();
        } else if (row >= 0 && row < (this.state.tafJSON.changegroups.length - 1)) { // Down from changegroup to changegroup
          this.refs['taftable'].refs['changegroup_' + (row + 1)].refs['sortablechangegroup'].refs['column_' + col].refs['inputfield'].focus();
        }
      }
    }
  }

  /*
    Event handler that is called upon jumping out of an input field.
  */
  onFocusOut () {
    this.updateTACtoTAFJSONtoTac();
    this.validateTAF(this.state.tafJSON);
  }

  /*
    This function adds a new changegroup to the TAF.
    This method is for example fired upon clicking the 'Add row button' next to changegroups.
  */
  onAddRow () {
    let newTaf = cloneObjectAndSkipNullProps(this.state.tafJSON);
    newTaf.changegroups.push({});
    this.setState({
      tafJSON: newTaf
    });
    this.validateTAF(newTaf);
  }

  /*
    This function removes a changeGroup by given rowIndex.
  */
  onDeleteRow (rowIndex) {
    let newTaf = cloneObjectAndSkipNullProps(this.state.tafJSON);
    newTaf.changegroups.splice(rowIndex, 1);
    this.setState({
      tafJSON: newTaf
    });
    this.validateTAF(newTaf);
  };

  /*
    Callback function called by SortableElement and SortableContainer when changegroups are sorted by Drag and Drop
  */
  onSortEnd ({ oldIndex, newIndex }) {
    let newTaf = cloneObjectAndSkipNullProps(this.state.tafJSON);
    newTaf.changegroups = arrayMove(newTaf.changegroups, oldIndex, newIndex);
    this.setState({
      tafJSON: newTaf
    });
    this.validateTAF(newTaf);
  };

  shouldComponentUpdate (nextProps, nextState) {
    return true;
  }

  componentWillReceiveProps (nextProps) {
    let tafJSON = null;
    if (nextProps.taf) {
      if (typeof nextProps.taf === 'string') {
        try {
          tafJSON = JSON.parse(nextProps.taf);
        } catch (e) {
          console.log(e);
        }
      } else {
        tafJSON = nextProps.taf;
      }
      if (tafJSON !== null) {
        if (tafJSON.changegroups) {
          let uuid = null;
          if (tafJSON.metadata && tafJSON.metadata.uuid) {
            uuid = tafJSON.metadata.uuid;
          }
          if (this.changegroupsSet === uuid) return;
          this.changegroupsSet = uuid;
          this.setState({
            tafJSON: cloneObjectAndSkipNullProps(tafJSON)
          });
          this.validateTAF(tafJSON);
        }
      }
    }
  }

  render () {
    const flatten = list => list.reduce(
      (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []
    );
    let validationErrors = null;
    let validationSucceeded = false;
    if (this.state.validationReport && this.state.validationReport.errors) {
      validationErrors = JSON.parse(this.state.validationReport.errors);
    }
    if (this.state.validationReport && this.state.validationReport.succeeded === true) {
      validationSucceeded = true;
    }

    const tafJson = removeInputPropsFromTafJSON(createTAFJSONFromInput(this.state.tafJSON));
    const items = [];
    items.push({ start: moment.utc(tafJson.metadata.validityStart), end: moment.utc(tafJson.metadata.validityEnd), properties: tafJson.forecast });
    tafJson.changegroups.map(group => items.push({ start: moment.utc(group.changeStart), end: moment.utc(group.changeEnd), properties: group.forecast }));

    return (
      <Row className='TafCategory'>
        <Row style={{ flex: 'auto' }}>
          <Col style={{ margin: '0px', padding:'4px', backgroundColor:'#EEE', flexDirection:'column', flex: 1 }}>
            <Row style={{ flex: 'unset' }}>
              <Col>{this.state.tafJSON.metadata.uuid}</Col>
            </Row>
            <Row style={{ flex: 'unset' }}>
              <Col>
                <TafTable
                  ref={'taftable'}
                  validationReport={this.state.validationReport}
                  tafJSON={this.state.tafJSON}
                  onSortEnd={this.onSortEnd}
                  onChange={this.onChange}
                  onKeyUp={this.onKeyUp}
                  onAddRow={this.onAddRow}
                  onDeleteRow={this.onDeleteRow}
                  editable={this.props.editable}
                  onFocusOut={this.onFocusOut} />
              </Col>
            </Row>
            { this.state.validationReport
              ? <Row className={validationSucceeded ? 'TAFValidationReportSuccess' : 'TAFValidationReportError'} style={{ flex: 'unset' }} >
                <Col style={{ flexDirection: 'column' }}>
                  <div><b>{this.state.validationReport.message}</b></div>
                  { validationErrors ? (flatten(Object.values(validationErrors).filter(v => Array.isArray(v)))).map((value, index) => {
                    return (<div key={'errmessageno' + index}>{(index + 1)} - {value}</div>);
                  }) : null}
                </Col>
              </Row> : null
            }
            { this.state.validationReport && this.state.validationReport.tac
              ? <Row className='TACReport'> <Col style={{ flexDirection: 'column' }}>{this.state.validationReport.tac}</Col></Row> : null }
            <Row style={{ flex: 'unset' }}>
              <Col />
              <Col xs='auto'>
                <Button color='primary' onClick={() => {
                  let taf = removeInputPropsFromTafJSON(createTAFJSONFromInput(this.state.tafJSON));
                  this.saveTaf(taf);
                }} >Save</Button>
              </Col>
              <Col xs='auto'>
                <Button disabled={!validationSucceeded} onClick={() => { alert('Sending a TAF out is not yet implemented'); }} color='primary'>Send</Button>
              </Col>
            </Row>
          </Col>
        </Row>
        { /* <Row style={{ flex: 'auto' }}>
          <Col>
            <TimeSchedule startMoment={moment.utc(tafJson.metadata.validityStart)} endMoment={moment.utc(tafJson.metadata.validityEnd)} items={items} />
          </Col>
        </Row> */
        }

      </Row>
    );
  }
}

TafCategory.propTypes = {
  taf: PropTypes.object,
  editable: PropTypes.bool
};

export default TafCategory;