class CompiledScript {
	constructor (listenerBlock, continuationID) {
		this.listenerBlock = listenerBlock;
		this.continuationID = continuationID;
	}
}

module.exports = CompiledScript;
