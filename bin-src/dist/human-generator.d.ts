/**
 * Human-Readable Generator
 *
 * Reads state.json → generates TASK.md + CHANGELOG.md in human/ directory
 * These files are READ-ONLY for humans. Agents write to protocol/ only.
 */
export declare class HumanGenerator {
    private dir;
    private protocolDir;
    private humanDir;
    constructor(projectRoot: string);
    generate(): void;
    private generateTaskMd;
    private generateChangelogMd;
    private generateStatusMd;
}
