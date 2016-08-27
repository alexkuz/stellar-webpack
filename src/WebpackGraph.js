import React, { PureComponent } from 'react';
import { Graph, Layout } from './springy3d';
import React3 from 'react-three-renderer';
import THREE from 'three';
import uniq from 'lodash.uniq';
import TouchableContainer from './TouchableContainer';
import MouseInput from './MouseInput';
import debounce from 'lodash.debounce';

function findDepth(v, e) {
  const ex = e._x, ey = e._y, ez = e._z;
  const x = v.x, y = v.y, z = v.z;

  const c1 = Math.cos( ex / 2 );
  const c2 = Math.cos( ey / 2 );
  const c3 = Math.cos( ez / 2 );
  const s1 = Math.sin( ex / 2 );
  const s2 = Math.sin( ey / 2 );
  const s3 = Math.sin( ez / 2 );

  const qx = s1 * c2 * c3 + c1 * s2 * s3;
  const qy = c1 * s2 * c3 - s1 * c2 * s3;
  const qz = c1 * c2 * s3 + s1 * s2 * c3;
  const qw = c1 * c2 * c3 - s1 * s2 * s3;


  // calculate quat * vector

  const ix =  qw * x + qy * z - qz * y;
  const iy =  qw * y + qz * x - qx * z;
  const iz =  qw * z + qx * y - qy * x;
  const iw = - qx * x - qy * y - qz * z;

  // calculate result * inverse quat

  return iz * qw + iw * - qz + ix * - qy - iy * - qx;
}

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

const updateNodes = (vertices, colors, nodes, rotation, hoverIdx) => {
  const depths = Array.from({ length: nodes.length });
  const order = Array.from({ length: nodes.length }).map((_, idx) => idx);

  const s = 1, l = 0.85;

  for (let i = nodes.length - 1; i >= 0; i--) {
    depths[i] = findDepth(nodes[i].p, rotation);
  }

  order.sort((i1, i2) => depths[i1] - depths[i2]);

  const color = new THREE.Color();
  let h, p;

  for (let i = nodes.length - 1; i >= 0; i--) {
    p = nodes[order[i]].p;

    vertices[i * 3] = p.x;
    vertices[i * 3 + 1] = p.y;
    vertices[i * 3 + 2] = p.z;

    h = (p.x + p.y + p.z) / 50;
    color.setHSL(h % 1, order[i] === hoverIdx ? 1 : s, order[i] === hoverIdx ? 1 : l);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return order;
}

const updateEdges = (vertices, colors, edges) => {
  const color = new THREE.Color();
  let h1, h2, p1, p2;

  for (var i = edges.length - 1; i >= 0; i--) {
    p1 = edges[i].p1;
    p2 = edges[i].p2;

    vertices[i * 6] = p1.x;
    vertices[i * 6 + 1] = p1.y;
    vertices[i * 6 + 2] = p1.z;
    vertices[i * 6 + 3] = p2.x;
    vertices[i * 6 + 4] = p2.y;
    vertices[i * 6 + 5] = p2.z;

    h1 = (p1.x + p1.y + p1.z) / 50;
    color.setHSL(h1 % 1, 0, 0.3);

    colors[i * 6] = color.r;
    colors[i * 6 + 1] = color.g;
    colors[i * 6 + 2] = color.b;

    h2 = (p2.x + p2.y + p2.z) / 50;
    color.setHSL(h2 % 1, 0.9, 0.7);

    colors[i * 6 + 3] = color.r;
    colors[i * 6 + 4] = color.g;
    colors[i * 6 + 5] = color.b;
  }
};

class WebpackGraphTree extends PureComponent {
  state = {
    nodeVertices: new Float32Array(),
    edgeVertices: new Float32Array(),
    nodeColors: new Float32Array(),
    edgeColors: new Float32Array(),
    sortedNodeIdx: [],
    cameraPosition: new THREE.Vector3(0, 0, 1000)
  };

  fog = new THREE.FogExp2(0x000022, 0.02);

  static defaultProps = {
    width: 1200,
    height: 800
  }

  componentDidMount() {
    this.updateVertices({}, this.props);

    document.addEventListener('mousemove', this.debouncedHandleMouseMove);
  }

  componentWillReceiveProps(nextProps) {
    this.updateVertices(this.props, nextProps);

  }

  componentDidUpdate(prevProps) {
    if (this.props.width !== prevProps.width ||
      this.props.height !== prevProps.height) {
      if (this.refs.mouseInput) {
        this.refs.mouseInput.containerResized();
      }
    }
  }

  updateVertices(props, nextProps) {
    const areEqual = (...keys) => {
      return !keys.find(key => nextProps[key] !== this.props[key]);
    };
    const hoverChanged = !areEqual('hoverIndex');

    let { edgeVertices, nodeVertices, cameraPosition,
          nodeColors, edgeColors, sortedNodeIdx } = this.state;

    if (!areEqual('zoom', 'edges')) {
      const scale = 20 / Math.pow(2, nextProps.zoom / 2) * Math.pow(nextProps.edges.length, 0.25);
      cameraPosition = new THREE.Vector3(0, 0, scale);
    }

    if (!areEqual('edges')) {
      const edges = nextProps.edges;

      if (edgeVertices.length !== edges.length * 6) {
        edgeVertices = new Float32Array(edges.length * 6);
        edgeColors = new Float32Array(edges.length * 6);
      }

      updateEdges(edgeVertices, edgeColors, nextProps.edges);
    }

    if (!areEqual('nodes', 'rotation') || hoverChanged) {
      // TODO: needs more optimization

      const nodes = nextProps.nodes;

      if (nodeVertices.length !== nodes.length * 3) {
        nodeVertices = new Float32Array(nodes.length * 3);
        nodeColors = new Float32Array(nodes.length * 3);
      }

      sortedNodeIdx = updateNodes(
        nodeVertices,
        nodeColors, 
        nextProps.nodes,
        nextProps.rotation,
        nextProps.hoverIndex
      );
    }

    this.setState({
      edgeVertices, edgeColors, nodeVertices, nodeColors, sortedNodeIdx, cameraPosition
    });
  }

  render() {
    const { width, height, rotation } = this.props;
    const { nodeVertices, nodeColors, edgeVertices, edgeColors, cameraPosition } = this.state;

    return (
      <div ref='container' style={{ width, height }}>
        <React3
          mainCamera='camera' // this points to the perspectiveCamera which has the name set to "camera" below
          width={width}
          height={height}
          onAnimate={this.handleAnimate}
          key={nodeVertices.length}
        >
          <module
            ref='mouseInput'
            descriptor={MouseInput}
          />
          <scene
            ref='scene'
            fog={this.fog}
          >
            <mesh
              position={new THREE.Vector3(0, 0, 0)}
              rotation={rotation}
            >
              <sphereGeometry
                radius={5000}
              />
              <meshLambertMaterial
                side={THREE.BackSide}
                fog={false}
              >
                <texture
                  url='static/Space.jpg'
                  wrapS={THREE.RepeatWrapping}
                  wrapT={THREE.RepeatWrapping}
                  anisotropy={16}
                />
              </meshLambertMaterial>
            </mesh>
            <perspectiveCamera
              name='camera'
              ref='camera'
              fov={75}
              aspect={width / height}
              near={0.1}
              far={10000}
              position={cameraPosition}
            />
            <pointLight
              color={0xffffff}
              position={cameraPosition}
            />
            <resources>
              <bufferGeometry
                resourceId='starsGeometry'
                position={new THREE.BufferAttribute(nodeVertices, 3)}
                color={new THREE.BufferAttribute(nodeColors, 3)}
              />
              <bufferGeometry
                resourceId='edgesGeometry'
                position={new THREE.BufferAttribute(edgeVertices, 3)}
                color={new THREE.BufferAttribute(edgeColors, 3)}
              />
            </resources>
            <group rotation={rotation}>
              <lineSegments>
                <geometryResource
                  resourceId='edgesGeometry'
                />
                <lineBasicMaterial
                  linewidth={2}
                  vertexColors={THREE.VertexColors}
                  opacity={0.5}
                  transparent
                />
              </lineSegments>
              <points ref='points'>
                <geometryResource
                  resourceId='starsGeometry'
                />
                <shaderMaterial
                  fragmentShader={require('./shaders/star.frag')}
                  vertexShader={require('./shaders/star.vert')}
                  transparent
                  alphaTest={0.5}
                  depthTest={false}
                  fog
                >
                  <uniforms>
                    <uniform type='float' name='size' value={0.4} />
                    <uniform type='vec3' name='fogColor' value={this.fog.color} />
                    <uniform type='float' name='fogDensity' value={this.fog.density} />
                  </uniforms>
                </shaderMaterial>
              </points>
            </group>
          </scene>
        </React3>
      </div>
    );
  }

  handleAnimate = () => {
    const mouseInput = this.refs.mouseInput;

    if (!mouseInput.isReady()) {
      mouseInput.ready(this.refs.scene, this.refs.container, this.refs.camera);
      mouseInput.setActive(false);
    }

    this.props.onAnimate();
  }

  handleMouseMove = event => {
    const mouseInput = this.refs.mouseInput;
    let hoverIndex;

    if (!mouseInput.isReady()) {
      return;
    }

    const intersections = mouseInput.intersectObject(
      new THREE.Vector2(event.clientX, event.clientY),
      this.refs.points
    );

    if (intersections.length) {
      hoverIndex = this.state.sortedNodeIdx[intersections[0].index];
    } else {
      hoverIndex = -1;
    }

    if (hoverIndex !== this.props.hoverIndex) {
      this.props.onHoverIndexChanged(hoverIndex);
    }
  }

  debouncedHandleMouseMove = debounce(this.handleMouseMove, 10, { leading: true });
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

    return (
      <div className='absolute left-0 top-0' style={{ width: '100vw', height: '100vh' }}>
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
            className='border col col-8'
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
        <div className='absolute bottom-0 left-0 white z1 clearfix mb2 ml2' style={{ width: '20rem' }}>
          <div className='clearfix'>
            <div className='col col-4 right-align pr2 mt2 pt1'>Zoom:</div>
            <div className='col col-8 left-align mt2'>
              <input
                className='pl2 pt1 pr2 pb1 rounded bg-black white border'
                value={zoom}
                type='number'
                min={1}
                max={15}
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
          <div className='clearfix'>
            <div className='col col-4 right-align pr2 mt2 pt1'>Upload Stats:</div>
            <div className='col col-8 left-align mt2 pt1'>
              <input
                type='file'
                className='pl2 pt1 pr2 pb1 border-none rounded'
                onChange={this.handleSelectFile}
              />
            </div>
          </div>
          <div className='clearfix'>
            <div className='col col-4 right-align pr2 mt2 pt1'>Tree size:</div>
            <div className='col col-8 left-align mt2 pt1'>
              {nodes.length}
            </div>
          </div>
          <div className='clearfix'>
            <div className='col col-4 right-align pr2 mt2 pt1'>Evolution:</div>
            <div className='col col-8 left-align mt2'>
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
