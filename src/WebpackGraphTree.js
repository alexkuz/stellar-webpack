import React, { PureComponent } from 'react';
import React3 from 'react-three-renderer';
import THREE from 'three';
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
    h = nodes[order[i]].hue;

    vertices[i * 3] = p.x;
    vertices[i * 3 + 1] = p.y;
    vertices[i * 3 + 2] = p.z;

    // h = (p.x + p.y + p.z) / 50;
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
    h1 = edges[i].hue1;
    h2 = edges[i].hue2;

    vertices[i * 6] = p1.x;
    vertices[i * 6 + 1] = p1.y;
    vertices[i * 6 + 2] = p1.z;
    vertices[i * 6 + 3] = p2.x;
    vertices[i * 6 + 4] = p2.y;
    vertices[i * 6 + 5] = p2.z;

    // h1 = (p1.x + p1.y + p1.z) / 50;
    color.setHSL(h1 % 1, 0, 0.3);

    colors[i * 6] = color.r;
    colors[i * 6 + 1] = color.g;
    colors[i * 6 + 2] = color.b;

    // h2 = (p2.x + p2.y + p2.z) / 50;
    color.setHSL(h2 % 1, 0.9, 0.7);

    colors[i * 6 + 3] = color.r;
    colors[i * 6 + 4] = color.g;
    colors[i * 6 + 5] = color.b;
  }
};

export default class WebpackGraphTree extends PureComponent {
  state = {
    nodeVertices: new Float32Array(),
    edgeVertices: new Float32Array(),
    nodeColors: new Float32Array(),
    edgeColors: new Float32Array(),
    sortedNodeIdx: [],
    cameraPosition: new THREE.Vector3(0, 0, 1000)
  };

  fog = new THREE.FogExp2(0x000022, 0.015);

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
