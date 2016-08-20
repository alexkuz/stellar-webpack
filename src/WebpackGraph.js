import React, { PureComponent } from 'react';
import { Graph, Layout } from './springy3d';
import React3 from 'react-three-renderer';
import THREE from 'three';
import uniq from 'lodash.uniq';
import TouchableContainer from './TouchableContainer';
import MouseInput from './MouseInput';

async function getDefaultStats() {
  const result = await fetch('stats.json');

  return await result.json();
}

function getTreeFromStats(json) {
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

const getColor = (p, s, l) => {
  const color = new THREE.Color();
  const sum = (p.x + p.y + (p.z || 0 )) / 50;

  color.setHSL(sum % 1, s, l);

  return color;
}

const getNodeVertices = (nodes, factor) =>
  nodes.map(node => new THREE.Vector3(node.p.x * factor, node.p.y * factor, (node.p.z || 0) * factor))

const getEdgeVertices = (edges, factor) => {
  const len = edges.length;
  const points = new Array(len * 2);

  for (var i = 0; i < len; i++) {
    const { p1, p2 } = edges[i];
    points[2*i] = new THREE.Vector3(p1.x * factor, p1.y * factor, (p1.z || 0) * factor);
    points[2*i + 1] = new THREE.Vector3(p2.x * factor, p2.y * factor, (p2.z || 0) * factor);
  }
  
  return points;
}

const getEdgeColors = edges => {
  const len = edges.length;
  const colors = new Array(len * 2);

  for (var i = 0; i < len; i++) {
    const { p1, p2 } = edges[i];
    colors[2*i] = getColor(p1, 0, 0.3);
    colors[2*i + 1] = getColor(p2, 0.9, 0.7);
  }
  
  return colors;
}

const getNodeColors = (nodes, s, l, hoverIndex) =>
  nodes.map(
    (node, index) => index === hoverIndex ? getColor(node.p, 1, 1) : getColor(node.p, s, l)
  ); 

class WebpackGraphTree extends PureComponent {
  state = {
    nodeVertices: [],
    edgeVertices: [],
    nodeColors: [],
    nodeGlowColors: [],
    edgeColors: [],
    scale: new THREE.Vector3(1, 1, 1),
    hoverIndex: -1
  };

  cameraPosition = new THREE.Vector3(0, 0, 1000);

  static defaultProps = {
    width: 1200,
    height: 800
  }

  componentDidMount() {
    this.updateVertices({}, this.props);

    document.addEventListener('mousemove', this.handleMouseMove);
  }

  componentWillReceiveProps(nextProps) {
    this.updateVertices(this.props, nextProps);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.hoverIndex !== prevState.hoverIndex) {
      this.setState({
        nodeColors: getNodeColors(this.props.nodes, 1, 0.95, this.state.hoverIndex),
        nodeGlowColors: getNodeColors(this.props.nodes, 1, 0.7, this.state.hoverIndex)
      });

      this.props.onHoverIndexChanged(this.state.hoverIndex);
    }
  }

  updateVertices(props, nextProps) {
    const areEqual = (...keys) => {
      return !keys.find(key => nextProps[key] !== this.props[key]);
    };

    if (!areEqual('zoom', 'edges')) {
      const scale = Math.pow(2, nextProps.zoom / 2) / Math.pow(nextProps.edges.length, 0.6);
      this.setState({
        scale: new THREE.Vector3(scale, scale, scale)
      });
    }

    if (!areEqual('edges')) {
      this.setState({
        edgeVertices: getEdgeVertices(nextProps.edges, 1)
      });
    }

    if (!areEqual('nodes')) {
      this.setState({
        nodeVertices: getNodeVertices(nextProps.nodes, 1)
      });
    }

    if (!areEqual('nodes')) {
      this.setState({
        nodeColors: getNodeColors(nextProps.nodes, 1, 0.95, this.state.hoverIndex),
        nodeGlowColors: getNodeColors(nextProps.nodes, 1, 0.7, this.state.hoverIndex)
      });
    }

    if (!areEqual('edges')) {
      this.setState({
        edgeColors: getEdgeColors(nextProps.edges)
      });
    }
  }

  render() {
    const { width, height, rotation, pointTexture, glowTexture } = this.props;
    const { nodeVertices, nodeColors, nodeGlowColors, edgeVertices, edgeColors, scale } = this.state;

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
            fog={new THREE.FogExp2(0x000022, 0.0005, 2000)}
          >
            <mesh
              position={new THREE.Vector3(0, 0, 0)}
              rotation={rotation}
            >
              <sphereGeometry
                radius={2000}
              />
              <meshLambertMaterial
                side={THREE.BackSide}
                fog={false}
              >
                <texture
                  url='Space.jpg'
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
              far={3000}
              position={this.cameraPosition}
            />
            <pointLight
              color={0xffffff}
              position={this.cameraPosition}
            />
            {/*
            <mesh
              position={new THREE.Vector3(-60, 33, 940)}
            >
              <textGeometry
                size={5}
                bevelSize={0.1}
                height={1}
                bevelThickness={0.1}
                bevelEnabled
                font={font}
                text='Stellar Webpack'
              />
              <meshPhongMaterial
                color={0x3366FF}
                side={THREE.DoubleSide}
              />
            </mesh>
          */}
            <group rotation={rotation} scale={scale}>
              <points>
                <geometry
                  // glowing for dummies (true shader glowing should be used instead)
                  vertices={nodeVertices}
                  colors={nodeGlowColors}
                />
                <pointsMaterial
                  size={50}
                  map={glowTexture}
                  vertexColors={THREE.VertexColors}
                  alphaTest={0.01}
                  opacity={0.07}
                  transparent
                  depthTest={false}
                />
              </points>
              <points>
                <geometry
                  vertices={nodeVertices}
                  colors={nodeGlowColors}
                />
                <pointsMaterial
                  size={44}
                  map={glowTexture}
                  vertexColors={THREE.VertexColors}
                  alphaTest={0.01}
                  opacity={0.07}
                  transparent
                  depthTest={false}
                />
              </points>
              <points>
                <geometry
                  vertices={nodeVertices}
                  colors={nodeGlowColors}
                />
                <pointsMaterial
                  size={38}
                  map={glowTexture}
                  vertexColors={THREE.VertexColors}
                  alphaTest={0.01}
                  opacity={0.07}
                  transparent
                  depthTest={false}
                />
              </points>
              <points>
                <geometry
                  vertices={nodeVertices}
                  colors={nodeGlowColors}
                />
                <pointsMaterial
                  size={32}
                  map={glowTexture}
                  vertexColors={THREE.VertexColors}
                  alphaTest={0.01}
                  opacity={0.07}
                  transparent
                  depthTest={false}
                />
              </points>
              <points ref='points'>
                <geometry
                  vertices={nodeVertices}
                  colors={nodeColors}
                />
                <pointsMaterial
                  size={32}
                  map={pointTexture}
                  vertexColors={THREE.VertexColors}
                  transparent
                  alphaTest={0.5}
                />
              </points>
              <lineSegments>
                <geometry
                  vertices={edgeVertices}
                  colors={edgeColors}
                />
                <lineBasicMaterial
                  linewidth={2}
                  vertexColors={THREE.VertexColors}
                  opacity={0.5}
                  transparent
                />
              </lineSegments>
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

    const intersections = mouseInput.intersectObject(
      new THREE.Vector2(event.clientX, event.clientY),
      this.refs.points
    );

    if (intersections.length) {
      this.setState({
        hoverIndex: intersections[0].index
      });
    } else {
      this.setState({
        hoverIndex: -1
      });
    }
  }
}

export default class WebpackGraph extends PureComponent {
  state = {
    stats: undefined,
    scale: 30,
    edges: [],
    nodes: [],
    zoom: 20,
    width: window.innerWidth,
    height: window.innerHeight,
    rotation: new THREE.Euler(),
    started: true,
    targetRotationX: 0,
    targetRotationY: 0,
    font: undefined
  };

  lastDate = new Date();

  componentDidMount() {
    window.addEventListener('resize', this.handleSizeChange);

    getDefaultStats().then(stats => this.setState({ stats }));

    new THREE.FontLoader().load('/typeface.json',
      font => this.setState({ font }),
      undefined,
      (e) => console.error('ERROR', e)
    );

    new THREE.TextureLoader().load('ball.png',
      pointTexture => this.setState({ pointTexture })
    );

    new THREE.TextureLoader().load('glow.png',
      glowTexture => this.setState({ glowTexture })
    );
  }

  handleSizeChange = () => {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });

    if (this.refs.mouseInput) {
      this.refs.mouseInput.containerResized();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.stats !== prevState.stats) {
      this.startLayout();
    }
  }

  handleAnimate = () => {
    const minRotationX = 0.0005;
    const minRotationY = 0.005;
    const { targetRotationX, targetRotationY, rotation } = this.state;
    const { x: rotationX, y: rotationY } = rotation;

    if (
      Math.abs(rotationY - targetRotationX - minRotationY) > 0.0001 ||
      Math.abs(rotationX - targetRotationY - minRotationX) > 0.0001
    ) {
      this.setState({
        rotation: new THREE.Euler(
          rotationX + (targetRotationY - rotationX) * 0.05,
          rotationY + (targetRotationX - rotationY) * 0.05,
          0
        )
      });
    } else {
      this.setState({
        rotation: new THREE.Euler(
          rotationX + minRotationX,
          rotationY + minRotationY,
          0
        ),
        targetRotationX: targetRotationX + minRotationX,
        targetRotationY: targetRotationY + minRotationY
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
    const { width, height, edges, nodes, scale, font, zoom, pointTexture, glowTexture,
            targetRotationX, targetRotationY, rotation, started, hoverIndex } = this.state;
    const roundButtonStyle = { cursor: 'pointer', width: '2rem', height: '2rem' };
    const buttonStyle = { cursor: 'pointer' };

    // if (!font) {
    //   return null;
    // }

    if (!pointTexture || !glowTexture) {
      return null;
    }

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
            scale={scale}
            className='border col col-8'
            rotation={rotation}
            onAnimate={this.handleAnimate}
            zoom={zoom}
            font={font}
            pointTexture={pointTexture}
            glowTexture={glowTexture}
            onHoverIndexChanged={hoverIndex => this.setState({ hoverIndex })}
          />
        </TouchableContainer>
        <div className='absolute left-0 top-0 mt3 ml3 z1 white'>
          <span style={{ fontSize: 30 }}>Stellar Webpack</span>
        </div>
        {(hoverIndex !== -1) && nodes[hoverIndex] &&
          <div className='absolute right-0 top-0 mt3 mr3 z1 white'>
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
                max={100}
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
                onClick={() => this.setState({ zoom: Math.min(100, zoom + 1) })}
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  handleZoom = zoomDelta => {
    const zoom = Math.min(100, Math.max(1, this.state.zoom + zoomDelta));

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
      this.layout.start(this.handleLayoutUpdate);
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
