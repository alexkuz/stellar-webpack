import React, { PureComponent } from 'react';
import { Graph, Layout } from './springy3d';
import THREE from 'three';
import uniq from 'lodash.uniq';
import TouchableContainer from './TouchableContainer';
import WebpackGraphTree from './WebpackGraphTree';
import Tooltip from 'rc-tooltip';

import 'rc-tooltip/assets/bootstrap.css';

async function getDefaultStats() {
  const result = await fetch('static/stats.json');

  return await result.json();
}

function getTreeFromStats(json) {
  // return {
  //   nodes: ['a', 'b', 'c', 'd', 'e'],
  //   edges: [
  //     ['a', 'b'],
  //     ['a', 'c'],
  //     ['a', 'd'],
  //     ['a', 'e']
  //   ]
  // };

  const tree = json.modules.reduce((t, module) =>
    module.reasons.reduce((t1, reason) => ({
      nodes: [...t1.nodes, reason.module, module.name],
      edges: [...t1.edges, [reason.module, module.name]]
    }), t), { nodes: [], edges: [] });

  return {
    nodes: uniq(tree.nodes),
    edges: tree.edges
  };
}

export default class WebpackGraph extends PureComponent {
  state = {
    stats: undefined,
    edges: [],
    nodes: [],
    zoom: 5,
    width: window.innerWidth,
    height: window.innerHeight,
    rotation: new THREE.Euler(),
    started: true,
    targetRotationX: 0,
    targetRotationY: 0,
    font: undefined,
    hoverIndex: -1,
    autoStop: false,
    autoRotate: true
  };

  lastDate = new Date();

  maxZoom = 15;

  componentDidMount() {
    window.addEventListener('resize', this.handleSizeChange);

    getDefaultStats().then(stats => this.setState({ stats }));
  }

  handleSizeChange = () => {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const autoStopChanged = prevState.autoStop !== this.state.autoStop;

    if (autoStopChanged && this.state.autoStop) {
      this.layout.stop();
    } else if (autoStopChanged && !this.state.autoStop) {
      if (this.state.started) {
        this.layout.start(this.handleLayoutUpdate);
      }
    } else if (this.state.stats !== prevState.stats) {
      this.startLayout();
    }
  }

  handleAnimate = () => {
    const minRotationX = this.state.autoRotate ? 0.0005 : 0; 
    const minRotationY = this.state.autoRotate ? 0.001 : 0;
    const { targetRotationX, targetRotationY, rotation } = this.state;
    const { x: rotationX, y: rotationY } = rotation;
    const toX = targetRotationY + minRotationX;
    const toY = targetRotationX + minRotationY;

    const autoStop = (Math.abs(rotationX - toX) > 0.1 || Math.abs(rotationY - toY) > 0.1);

    if (
      Math.abs(rotationX - toX) > 0.01 ||
      Math.abs(rotationY - toY) > 0.01
    ) {
      this.setState({
        rotation: new THREE.Euler(
          rotationX + (toX - rotationX) * 0.05,
          rotationY + (toY - rotationY) * 0.05,
          0
        ),
        targetRotationY: targetRotationY + minRotationX,
        targetRotationX: targetRotationX + minRotationY,
        autoStop
      });
    } else {
      this.setState({
        rotation: new THREE.Euler(
          rotationX + minRotationX,
          rotationY + minRotationY,
          0
        ),
        targetRotationY: targetRotationY + minRotationX,
        targetRotationX: targetRotationX + minRotationY,
        autoStop
      });
    }
  };

  startLayout() {
    if (this.layout) {
      this.layout.stop();
    }

    const tree = getTreeFromStats(this.state.stats);

    const graph = new Graph(tree);

    this.layout = new Layout.ForceDirected(graph, 200.0, 100.0, 0.5);

    this.layout.start(this.handleLayoutUpdate);

    this.setState({ started: true });
  }

  handleLayoutUpdate = () => {
    this.setState({
      edges: this.layout.graph.edges.map(e => {
        const spring = this.layout.spring(e);
        return { id: e.id, p1: spring.point1.p, p2: spring.point2.p };
      }),
      nodes: this.layout.graph.nodes.map(n =>
        ({ id: n.id, p: this.layout.point(n).p })
      )
    });
  }

  render() {
    const { width, height, edges, nodes, font, zoom,
            targetRotationX, targetRotationY, rotation, started, hoverIndex } = this.state;
    const roundButtonStyle = { cursor: 'pointer', width: '2rem', height: '2rem' };
    const buttonStyle = { cursor: 'pointer' };

    const rotX = (rotation.x / Math.PI) % 2;

    const nodeCount = `${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'}`;

    return (
      <div className='absolute left-0 top-0 right-0 bottom-0'>
        <TouchableContainer
          width={width}
          height={height}
          onUpdateRotation={this.handleUpdateRotation}
          onZoom={this.handleZoom}
          targetRotationX={targetRotationX}
          targetRotationY={targetRotationY}
          inverseX={Math.round(rotX) % 2}
        >
          <WebpackGraphTree
            width={width}
            height={height}
            edges={edges}
            nodes={nodes}
            rotation={rotation}
            onAnimate={this.handleAnimate}
            zoom={zoom}
            font={font}
            hoverIndex={hoverIndex}
            onHoverIndexChanged={hoverIndex => this.setState({ hoverIndex })}
          />
        </TouchableContainer>
        <div className='absolute left-0 top-0 mt3 ml3 z1 white'>
          <span style={{ fontSize: 30 }}>Stellar Webpack</span>
        </div>
        {(hoverIndex !== -1) && nodes[hoverIndex] &&
          <div className='absolute right-0 top-0 mt4 mr3 z1 white'>
            {nodes[hoverIndex].id}
          </div>
        }
        <div
          className='absolute bottom-0 left-0 white z1 clearfix pb2 pl2'
          style={{
            opacity: this.state.controlHovered ? 1 : 0.3,
            transition: this.state.controlHovered ? 'opacity 0.15s' : 'opacity 0.2s'
          }}
          onMouseEnter={() => this.setState({ controlHovered: true })}
          onMouseLeave={() => this.setState({ controlHovered: false })}
        >
          <div className='clearfix flex items-center xs-hide'>
            <div className='col col-5 right-align pr2'>Upload Stats:</div>
            <div className='col col-7 left-align flex items-center nowrap'>
              <input
                type='file'
                className='pl2 pt1 pr2 pb1 rounded bg-black white border'
                style={{ maxWidth: '8rem' }}
                onChange={this.handleSelectFile}
              />
              <Tooltip
                placement='right'
                trigger={['hover']}
                overlay={
                  <div>
                    To create <code>stats.json</code> for your project, use this command:
                    <br/>
                    <pre>webpack --profile --json > stats.json</pre>
                  </div>
                }
              >
                <div
                  className='ml1 pt1 center circle bg-black white border flex-none border-box'
                  style={roundButtonStyle}
                >
                  ?
                </div>
              </Tooltip>
            </div>
          </div>
          <div className='clearfix flex items-center mt2'>
            <div className='col col-5 right-align pr2'>Zoom:</div>
            <div className='col col-7 left-align nowrap'>
              <input
                className='pl2 pt1 pr2 pb1 rounded bg-black white border'
                value={zoom}
                type='number'
                min={1}
                max={15}
                style={{ width: '3rem' }}
                onChange={e => this.setState({ zoom: parseInt(e.target.value, 10) })}
              />
              <button
                className='ml1 pl1 pr1 circle bg-black white border'
                style={roundButtonStyle}
                onClick={() => this.setState({ zoom: Math.max(0, zoom - 1) })}
              >
                <span style={{ fontSize: 16 }}>-</span>
              </button>
              <button
                className='ml1 pl1 pr1 circle bg-black white border'
                style={roundButtonStyle}
                onClick={() => this.setState({ zoom: Math.min(this.maxZoom, zoom + 1) })}
              >
                <span style={{ fontSize: 16 }}>+</span>
              </button>
            </div>
          </div>
          <div className='clearfix flex items-center mt2'>
            <div className='col col-5 right-align pr2'>Tree size:</div>
            <div className='col col-7 left-align nowrap'>
              {nodeCount}
            </div>
          </div>
          <div className='clearfix flex items-center mt2'>
            <div className='col col-5 right-align pr2'>Evolution:</div>
            <div className='col col-7 left-align nowrap'>
              <button
                className='pt1 pb1 pl2 pr2 rounded bg-black white border'
                onClick={this.toggleEvolution}
                style={buttonStyle}
              >
                {started ? 'Stop' : 'Start'}
              </button>
              <input
                className='ml2'
                onChange={() => this.setState({ autoRotate: !this.state.autoRotate })}
                checked={this.state.autoRotate}
                type='checkbox'
                id='rotate'
              />
              <label htmlFor='rotate' className='ml1'><small>Auto-Rotate</small></label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  handleZoom = zoomDelta => {
    const zoom = Math.min(this.maxZoom, Math.max(1, this.state.zoom + zoomDelta));

    this.setState({ zoom });
  }

  handleUpdateRotation = ({ targetRotationX, targetRotationY }) => {
    this.setState({
      targetRotationX,
      targetRotationY
    });
  }

  toggleEvolution = () => {
    if (this.state.started) {
      this.setState({ started: false });
      this.layout.stop();
    } else {
      this.setState({ started: true });
      if (!this.state.autoStop) {
        this.layout.start(this.handleLayoutUpdate);
      }
    }
  }

  handleSelectFile = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = this.handleFileLoad;

    reader.readAsText(file);
  }

  handleFileLoad = e => {
    const stats = JSON.parse(e.target.result);

    this.setState({ stats });
  }
}
