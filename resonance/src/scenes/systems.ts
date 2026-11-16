// Registers every scene system (landmarks, props, traffic, wildlife, weather) with the World.
import {makeBillboards, makeRain, makeSteamAndMist} from './fx';
import {makeLandmarks} from './landmarks';
import {makeAircraft, makeBirds, makeFerries, makeFigure} from './life';
import {makeProps} from './props';
import {makeTraffic} from './traffic';
import type {World} from './world';

export const addSystems = (world: World) => {
	world.add(makeLandmarks(world));
	world.add(makeProps(world));
	world.add(makeTraffic(world));
	world.add(makeBillboards(world));
	world.add(makeBirds(world));
	world.add(makeAircraft(world));
	world.add(makeFerries(world));
	world.add(makeFigure(world));
	world.add(makeSteamAndMist(world));
	world.add(makeRain(world));
};
