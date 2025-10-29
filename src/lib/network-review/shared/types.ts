import { LinkType, NodeType } from "src/hydraulic-model";

type NodeConnections = number[];
type LinkConnections = [number, number];
type LinkId = number;
type NodeId = number;
type SegmentId = number;

export interface Topology {
  getLinkConnections(linkId: LinkId): LinkConnections;
  getNodeConnections(nodeId: NodeId): NodeConnections;
}

type Position = [number, number];
type Bounds = [number, number, number, number];
type RadiusSearch = { coordinates: Position; radius: number };
type BoundsSearch = Bounds;

type SearchOptions = RadiusSearch | BoundsSearch;

export interface GeoIndex {
  findLinks(search: SearchOptions, count?: number): [LinkId, SegmentId][];
  findNodes(search: SearchOptions, count?: number): NodeId[];
  getLinkBounds(linkId: LinkId): Bounds;
  getSegmentCoordinates(segmentId: SegmentId): [Position, Position];
  getNodeCoordinates(nodeId: NodeId): Position;
}

export interface Assets {
  getNodeType(nodeId: NodeId): NodeType;
  getLinkType(linkId: LinkId): LinkType;
  iterateNodes(): Generator<NodeId>;
  iterateLinks(): Generator<LinkId>;
  nodesCount: number;
  linksCount: number;
}
