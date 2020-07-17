/**
 * # Main schema definition
 *
 * ## Contents:
 * - [[Program]]
 * - [[ProgramMetadata]]
 * - [[State]]
 * - [[DropEvent]] (and subtypes/interfaces)
 * -------
 * - [[Performance]]
 * - [[PerformanceMetadata]]
 * - Events
 * -------
 * Ordered by Machine, Vibraphone, Bass,
 * HiHat machine, HiHat:
 * - sub-States
 * - sub-Events
 * @packageDocumentation
 */
import { Note } from "./note_names";

/**
 * All possible drums that can be played. Used for specifying which drum
 * to play in a [[DrumDropEvent]].
 */
export type DrumType = "bassdrum" | "hihat" | "snare";

/**
 * A channel that can be muted. Used as keys in the [[MachineState.mute]] object.
 *
 * ## Example
 * ```typescript
 * // specifies that the bassdrum and vibraphone are muted
 * const state: MachineState = {
 *   mute: {
 *     bassdrum: true,
 *     vibraphone: true,
 *   },
 *   ...
 * };
 * ```
 */
export type Channel = DrumType | "vibraphone" | "bass";

/**
 * The program represents the MMX's programming wheel, which can/will have multiple rotations throughout the 
 * [[Performance]]. It can also have its tempo changed or stopped completely. Other musician actions such as 
 * manually dropping marbles is done outside of the Program in the Performance.
 */
export interface Program {
	/**
	 * Information about this program. It can be distinct from a performance's metadata.
	 */
	metadata: ProgramMetadata;
	/**
	 * This is the "working" state of the machine, outside of a performance.
	 * When a user is modifying the program, this is how we store what settings they use.
	 * Whenever the user saves, this field gets updated, and whether they load, this gets read.
	 * It has almost no relevance when editing a performance since the performance events will
	 * cause it to be updated dynamically.
	 *
	 * ## Example
	 * ```typescript
	 * let prog: Program;
	 * // invert the muted state of the snare
	 * prog.state.machine.mute.snare = !prog.state.machine.mute.snare;
	 * ```
	 */
	state: State;
	/**
	 * All the [[TickedDropEvent]]s that occur during this program. They *must* be in ascending order by tick.
	 */
	dropEvents: TickedDropEvent[];
}

/** Metadata about a program. Used to indicate how this program should be played. */
export interface ProgramMetadata {
	/**
	 * The title of this program. It can be distinct from the title of the performance.
	 */
	title: string;
	/**
	 * The author of this program. It can be distinct from the title of the performance.
	 */
	author: string;
	/**
	 * Ticks per quarter.
	 * This basically represents how many distinct pieces a quarter note is divisible by.
	 * The higher the TPQ, the more flexibility when it comes to placing notes.
	 */
	readonly tpq: 240;
	/** Version of VMMX in which the current program was made */
	readonly version: string;
	/** Total ticks on the "programming wheel" 240 PPQ * 4 beats/measure * 16 bars on wheel */
	readonly length: 61440;
	/** The amount of procrastination that occurred during the making of this program. */
	procrastination?: number;
}

/** The machine's state. Used to specify both the start state and running state of the machine. */
export interface State {
	machine: MachineState;
	vibraphone: VibraphoneState;
	bass: BassState;
	hihatMachine: HihatMachineState;
	hihat: HihatState;
}

/** The dropping of a single marble with no timing information. */
export type DropEvent = BassDropEvent | DrumDropEvent | VibraphoneDropEvent;

/** The dropping of a single marble with an associated tick. */
export type TickedDropEvent = TickedEvent & DropEvent;

/** Information common to all ticked events. */
export interface TickedEvent {
	/** The tick (pulse) that the event appears. */
	tick: number;
}

/** The dropping of a single bass marble. */
export interface BassDropEvent {
	kind: "bass";
	/** The string (not note) to drop the marble onto. */
	string: BassString;
	/**
	 * The fret to be played when this marble hits.
	 *
	 * Even though this technically requires user input, we opted to specify the fret here
	 * because it's much simpler than requiring a separate fret pressed event in the program.
	 */
	fret: number;
}

/** The dropping of a single drum marble. */
export interface DrumDropEvent {
	kind: "drum";
	/** The drum to drop the marble onto. */
	drum: DrumType;
}

/** The dropping of a single vibraphone marble. */
export interface VibraphoneDropEvent {
	kind: "vibraphone";
	/** The channel (key) to drop the marble onto.
	 *
	 * To figure out which note it will play, the [[VibraphoneState.notes]]
	 * property must be referenced.
	 * ```typescript
	 * const vDropEvent: VibraphoneDropEvent;
	 * const vState: VibraphoneState;
	 * const noteHit = vState.notes[vDropEvent.channel];
	 * ```
	 */
	channel: VibraphoneChannel;
}

export enum EventBakeType {
	AUTO,
	MODIFIED_AUTO,
	MANUAL,
}

export type PerformanceDropEvent = DropEvent & CorePerformanceDropEvent;

export interface CorePerformanceDropEvent {
	bakeType: EventBakeType;
}

/**
 * A single performance of the associated [[Program]].
 *
 * Performances contain all events that exist outside of the
 * programming wheel. This could be a manual drop, a change of
 * one of the bass capos, or any other event in the [[Event]] type.
 */
export interface Performance {
	/** Information about this performance. */
	metadata: PerformanceMetadata;
	/** The program associated with this performance. */
	program: Program;
	/**
	 * The state of the machine at the start of the performance.
	 *
	 * Note that this should not be changed during the performance.
	 * Use [[Program.state]] if you want to keep track of the current
	 * state of the machine. This means that [[Performance.initialState]]
	 * should be copied into [[Program.state]] at tick 0 of Performance playback.
	 */
	readonly initialState: State;
	/**
	 * The events that make up this performance. As with [[Program.dropEvents]],
	 * these events must be in ascending order.
	 * The performance events will be merged with program events on runtime, depending on
	 * the performance events at a specific tick. Performance event ticks and program ticks
	 * are always in sync (although the program might be stopped while the performance still
	 * continues).
	 */
	events: TickedPerformanceEvent[];
}

/** Metadata for performance */
export interface PerformanceMetadata {
	/**
	 * The title of the performance.
	 * This doesn't have to be the same as the title of the program.
	 */
	title: string;
	/**
	 * The author/performer of the performance.
	 * This doesn't have to be the same as the author of the program.
	 */
	author: string;
}

/**
 * An untimed event that changes the state of one channel
 * or manually drops a marble.
 *
 * Events only change one thing. Multiple simultaneous changes must
 * be represented by multiple events with the same tick.
 */
export type Event =
	| PerformanceDropEvent
	| MachineEvent
	| VibraphoneEvent
	| HihatMachineEvent
	| HihatEvent
	| BassEvent;

/** An event occurring during a performance. We also count them in ticks to be in sync with program events. */
export type TickedPerformanceEvent = TickedEvent & Event;

/**
 * The overall state of the machine. Everything that's
 * not specific to a particular instrument is represented here.
 */
export interface MachineState {
	/** Whether or not particular [[Channel]] is muted. */
	mute: { [C in Channel]?: boolean };
	/** The beats per minute the machine is operating at. */
	bpm: number;
	/** Whether or not the programming wheel is spinning. */
	flywheelConnected: boolean;
}

/**
 * All possible events relating to the machine itself.
 */
export type MachineEvent = ChannelMuteEvent;

/** The muting or unmuting of a [[Channel]] */
export interface ChannelMuteEvent {
	kind: "machine_mute";
	/** The channel affected. */
	channel: Channel;
	/** Whether or not the channel should be muted or unmuted. */
	muted: boolean;
}

/**
 * A change in the machine's BPM.
 *
 * This change will be instantaneous, so if a gradual change is
 * desired, it must be achieved by specifying small increments of
 * change to the BPM. This may change in the future.
 */
export interface MachineTempoEvent {
	kind: "machine_tempo";
	/** The BPM to set the machine to. */
	bpm: number;
}

/**
 * The flywheel getting connected or disconnected.
 *
 * This equates to the programming wheel starting or stopping instantaneously.
 */
export interface FlywheelConnectedEvent {
	kind: "machine_flywheelConnected";
	/**
	 * Whether or not the flywheel is connected and thus also
	 * whether or not the programming wheel is turning.
	 */
	connected: boolean;
}

/**
 * Every channel that can be played on the vibraphone.
 *
 * We decided to start at one since the [[BassString]] type also
 * starts at one. We also decided to only represent playable
 * channels and not actual channels (two per note).
 */
export type VibraphoneChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * The state pertaining to the vibraphone.
 */
export interface VibraphoneState {
	/** Whether or not the vibrato is engaged */
	vibratoEnabled: boolean;
	/** The vibrato speed from 0 to 1 */
	vibratoSpeed: number;
	/**
	 * Which notes represent which channels.
	 * These cannot be changed via events and thus stay
	 * the same throughout the course of an entire [[Performance]].
	 * They can however, be changed while editing a [[Program]].
	 */
	notes: { [VC in VibraphoneChannel]: Note };
}

/**
 * Any event pertaining to the vibraphone.
 */
export type VibraphoneEvent =
	| VibraphoneVibratoEnabledEvent
	| VibraphoneVibratoSpeedEvent;

/** An event corresponding to a change in the [[VibraphoneState.vibratoEnabled]] property. */
export interface VibraphoneVibratoEnabledEvent {
	kind: "vibraphone_vibrato_enabled";
	/** Whether or not the vibrato should be enabled. */
	vibratoEnabled: boolean;
}

/** An event corresponding to a change in the [[VibraphoneState.vibratoSpeed]] property */
export interface VibraphoneVibratoSpeedEvent {
	kind: "vibraphone_vibrato_speed";
	/** The new speed of the vibrato. */
	vibratoSpeed: number;
}

/**
 * A single string on the bass.
 *
 * We chose to start at one since musicians count
 * starting from one. String 1 is highest pitched
 * string, and string 4 is the lowest pitched string.
 */
export type BassString = 1 | 2 | 3 | 4;

/** The state pertaining to the bass. */
export interface BassState {
	/**
	 * Which frets the capos are on.
	 * `0` or nothing means no capo is applied to that string.
	 */
	capos: { [S in BassString]?: number };
	/**
	 * Which notes the strings are tuned to.
	 * Nothing means the standard bass tuning:
	 * ```typescript
	 * {
	 *   4: "E1",
	 *   3: "A1",
	 *   2: "D2",
	 *   1: "G2",
	 * }
	 * ```
	 */
	tuning: { [S in BassString]?: Note };
}

/** Any event pertaining to the bass. */
export type BassEvent = BassCapoEvent;

/** An event corresponding to a capo being applied, moved, or removed. */
export interface BassCapoEvent {
	kind: "bass_capo";
	/** Which string is affected. */
	capoString: BassString;
	/**
	 * Which fret is the capo to be applied to.
	 * `0` or nothing means no capo is applied.
	 */
	fret: number;
}

/** The state pertaining to the hihat machine. */
export interface HihatMachineState {
	/** The meaning of this property has yet to be determined. */
	setting: string;
}

/** Any event pertaining to the hihat machine. */
export type HihatMachineEvent = HihatMachineSettingEvent;

/** An event corresponding to a change in the hihat machine's setting. */
export interface HihatMachineSettingEvent {
	kind: "hihatmachine_setting";
	/**
	 * The new hihat machine state.
	 * This will probably change whenever the [[HihatMachineState.setting]]
	 * is assigned a meaning.
	 */
	state: HihatMachineState;
}

/** The state pertaining to the hihat, not the hihat machine. */
export interface HihatState {
	/** Whether or not the hihat is closed. */
	closed: boolean;
}

/** Any event pertaining to the hihat, not the hihat machine. */
export type HihatEvent = HihatClosedEvent;

/** An event corresponding to a change in the hihat closed status. */
export interface HihatClosedEvent {
	kind: "hihat_closed";
	/** Whether or not the hihat should be closed or opened. */
	closed: boolean;
}
