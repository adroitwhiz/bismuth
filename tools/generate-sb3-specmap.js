// Generate a 'specmap' containing the argument types for all Scratch 3.0 block inputs,
// based on the block toolbox from the latest version of scratch-blocks.
// TODO: Figure out a way to just run scratch-blocks and generate the specmap from there.

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const xml2js = require('xml2js');

// Fetch non-shadowed inputs. Currently only booleans and substacks.
const fetchNonShadowedInputs = category => {
	return fetch(`https://raw.githubusercontent.com/LLK/scratch-blocks/develop/blocks_vertical/${category}.js`)
		.then(response => response.text())
		.then(responseText => {
			responseText = responseText.replace(/this\.jsonInit/g, 'return ');

			const blocks = [];

			const nullProxy = new Proxy({}, {get: () => null});

			const context = {
				// Mock goog.provide and goog.require.
				goog: {
					provide: () => {},
					require: () => {}
				},
				// Mock Blockly.Blocks.
				Blockly: {
					Msg: nullProxy,
					mainWorkspace: {
						options: {

						}
					},
					Categories: nullProxy,
					Colours: new Proxy({}, {get: () => nullProxy}),
					Blocks: {},
					Constants: nullProxy
				},

				jsonInit: input => { blocks.push(input); }
			};
			context.Blockly.Colours[category] = nullProxy;
			try {
				vm.runInNewContext(responseText, context);
			} catch (err) {
				console.log(err, category);
			}

			const specMap = {};
			for (const blockName of Object.keys(context.Blockly.Blocks)) {
				try {
					const block = context.Blockly.Blocks[blockName].init();
					const args = {};

					for (const key of Object.keys(block)) {
						if (key.startsWith('args')) {
							for (const arg of block[key]) {
								if (!(arg.type === 'input_statement' || arg.type === 'input_value')) continue;
								args[arg.name] = arg.type;
							}
						}
					}

					specMap[blockName] = args;
				}
				catch (err) {
					console.log('failed to parse block', blockName, err);
				}
			}

			return specMap;
		});
};

// The data section is added in via JS. Manually add it to the XML.
const dataSectionXML = `
<category>
 <block id="variableId" type="data_variable">
    <field name="VARIABLE">variablename</field>
 </block>
 <block type="data_setvariableto" gap="20">
   <value name="VARIABLE">
    <shadow type="data_variablemenu"></shadow>
   </value>
   <value name="VALUE">
     <shadow type="text">
       <field name="TEXT">0</field>
     </shadow>
   </value>
 </block>
 <block type="data_changevariableby">
   <value name="VARIABLE">
    <shadow type="data_variablemenu"></shadow>
   </value>
   <value name="VALUE">
     <shadow type="math_number">
       <field name="NUM">1</field>
     </shadow>
   </value>
 </block>
 <block type="data_showvariable">
   <value name="VARIABLE">
     <shadow type="data_variablemenu"></shadow>
   </value>
 </block>
 <block type="data_hidevariable">
   <value name="VARIABLE">
     <shadow type="data_variablemenu"></shadow>
   </value>
 </block>
 <block id="variableId" type="data_listcontents">
    <field name="LIST">variablename</field>
 </block>
 <block type="data_addtolist">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="ITEM">
     <shadow type="text">
       <field name="TEXT">thing</field>
     </shadow>
   </value>
 </block>
 <block type="data_deleteoflist">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="INDEX">
     <shadow type="math_integer">
       <field name="NUM">1</field>
     </shadow>
   </value>
 </block>
 <block type="data_deletealloflist">
   <field name="LIST" variabletype="list" id="">variablename</field>
 </block>
 <block type="data_insertatlist">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="INDEX">
     <shadow type="math_integer">
       <field name="NUM">1</field>
     </shadow>
   </value>
   <value name="ITEM">
     <shadow type="text">
       <field name="TEXT">thing</field>
     </shadow>
   </value>
 </block>
 <block type="data_replaceitemoflist">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="INDEX">
     <shadow type="math_integer">
       <field name="NUM">1</field>
     </shadow>
   </value>
   <value name="ITEM">
     <shadow type="text">
       <field name="TEXT">thing</field>
     </shadow>
   </value>
 </block>
 <block type="data_itemoflist">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="INDEX">
     <shadow type="math_integer">
       <field name="NUM">1</field>
     </shadow>
   </value>
 </block>
 <block type="data_itemnumoflist">
   <value name="ITEM">
     <shadow type="text">
       <field name="TEXT">thing</field>
     </shadow>
   </value>
   <field name="LIST" variabletype="list" id="">variablename</field>
 </block>
 <block type="data_lengthoflist">
   <field name="LIST" variabletype="list" id="">variablename</field>
 </block>
 <block type="data_listcontainsitem">
   <field name="LIST" variabletype="list" id="">variablename</field>
   <value name="ITEM">
     <shadow type="text">
       <field name="TEXT">thing</field>
     </shadow>
   </value>
 </block>
 <block type="data_showlist">
   <field name="LIST" variabletype="list" id="">variablename</field>
 </block>
 <block type="data_hidelist">
   <field name="LIST" variabletype="list" id="">variablename</field>
 </block>
</category>
`;

Promise.all([
	// Fetch shadowed inputs (ones with types like math_number, etc).
	Promise.all([
		fetch('https://raw.githubusercontent.com/LLK/scratch-blocks/develop/blocks_vertical/default_toolbox.js')
			.then(response => response.text())
			.then(responseText => {
				// Evaluate the toolbox XML creation code in a VM context.
				const context = {
					// Mock goog.provide and goog.require.
					goog: {
						provide: () => {},
						require: () => {}
					},
					// Mock Blockly.Blocks.
					Blockly: {
						Blocks: {}
					}
				};
				vm.runInNewContext(responseText, context);

				// Parse the toolbox XML.
				const toolboxXMLString = context.Blockly.Blocks.defaultToolbox;
				return xml2js.parseStringPromise(toolboxXMLString);
			}),
		xml2js.parseStringPromise(dataSectionXML)
	])
		.then(xmls => {
			// Patch in the data section
			const xml = xmls[0];
			const dataCategory = xmls[0].xml.category.find(cat => cat.$.id === 'data');
			dataCategory.block = xmls[1].category.block;
			const specMap = {};

			for (const category of xml.xml.category) {
				if (!category.hasOwnProperty('block')) continue;
				for (const block of category.block) {
					const values = {};

					if (block.hasOwnProperty('value')) {
						for (const value of block.value) {
							values[value.$.name] = value.shadow[0].$.type;
						}
					}

					if (block.$.type !== block.$.id)
						console.warn(`Warning: block has type '${block.$.type}' but ID '${block.$.id}'`);
					specMap[block.$.type || block.$.id] = values;
				}
			}

			return specMap;
		}),
	Promise.all(['control', 'data', 'event', 'looks', 'motion', 'operators', 'sensing', 'sound'].map(fetchNonShadowedInputs))
		.then(specMaps => Object.assign({}, ...specMaps))
]).then(results => {
	const shadowedSpecMap = results[0];
	const nonShadowedSpecMap = results[1];

	const finalSpecMap = {};

	for (const blockName of Object.keys(shadowedSpecMap)) {
		const mergedSpec = Object.assign({}, shadowedSpecMap[blockName]);

		if (nonShadowedSpecMap.hasOwnProperty(blockName)) {
			for (const nonShadowedArg of Object.keys(nonShadowedSpecMap[blockName])) {
				if (mergedSpec.hasOwnProperty(nonShadowedArg)) continue;
				mergedSpec[nonShadowedArg] = nonShadowedArg.startsWith('SUBSTACK') ? 'substack' : 'boolean';
			}
		} else {
			console.warn(`non-shadowed specmap missing ${blockName}`);
		}

		finalSpecMap[blockName] = mergedSpec;
	}

	return fs.writeFile(path.join(__dirname, 'specmap-sb3.json'), JSON.stringify(finalSpecMap, null, '\t'));
});
